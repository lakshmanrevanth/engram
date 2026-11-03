// Optimistic updates for the /api/daily/summary cache. Pure, so they're easy to test.

type Confidence = 'CLEAN' | 'SHAKY' | 'STRUGGLED';

export type DailyStreak = {
  currentStreak: number;
  bestStreak: number;
  todayCompleted: boolean;
  todayReviewed: number;
  dailyGoal: number;
  goalMet: boolean;
  goalBasedStreak: boolean;
};

export type DailySummary = {
  today: string;
  due: any[];
  revisedToday: any[];
  streak: DailyStreak;
  counts: { total: number; mastered: number };
  ladder: number[];
  upcoming: { date: string; count: number } | null;
};

/** Same order as the server: lowest ladder step first, then most overdue. */
export function sortDue<T extends { currentStep?: number; daysOverdue?: number }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => (a.currentStep ?? 0) - (b.currentStep ?? 0) || (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0)
  );
}

function withReviewed(streak: DailyStreak, reviewed: number): DailyStreak {
  const threshold = streak.goalBasedStreak ? Math.max(1, streak.dailyGoal) : 1;
  const completed = reviewed >= threshold;
  let currentStreak = streak.currentStreak;
  if (completed && !streak.todayCompleted) currentStreak += 1;
  if (!completed && streak.todayCompleted) currentStreak = Math.max(0, currentStreak - 1);
  return {
    ...streak,
    todayReviewed: reviewed,
    todayCompleted: completed,
    goalMet: reviewed >= streak.dailyGoal,
    currentStreak,
    bestStreak: Math.max(streak.bestStreak, currentStreak),
  };
}

/**
 * Moves a rated problem from the due list to "completed today".
 * Call again with the server response to fill in revisionId and the new step; that second call
 * doesn't count the review twice.
 */
export function applyDailyRating(
  s: DailySummary,
  problem: any,
  conf: Confidence,
  server?: Record<string, any>
): DailySummary {
  const wasDue = s.due.some((p) => p.id === problem.id);
  const existing = s.revisedToday.find((p) => p.id === problem.id);
  const { revisionId, ...serverProblem } = server ?? {};
  const latestRevision = {
    ...(existing?.latestRevision ?? {}),
    id: revisionId ?? existing?.latestRevision?.id ?? null,
    confidence: conf,
    type: problem.isRecheck ? 'RECHECK' : 'REGULAR',
    stepBefore: problem.currentStep ?? 0,
    stepAfter: serverProblem.currentStep ?? existing?.latestRevision?.stepAfter ?? problem.currentStep ?? 0,
    revisedAt: existing?.latestRevision?.revisedAt ?? new Date().toISOString(),
  };
  const item = { ...problem, ...(existing ?? {}), ...serverProblem, latestRevision };
  const revisedToday = [item, ...s.revisedToday.filter((p) => p.id !== problem.id)];

  if (!wasDue) return { ...s, revisedToday };
  return {
    ...s,
    due: s.due.filter((p) => p.id !== problem.id),
    revisedToday,
    streak: withReviewed(s.streak, s.streak.todayReviewed + 1),
  };
}

/** Takes a rating back: removes it from "completed today" and puts the due row back if we have it. */
export function applyDailyUndo(s: DailySummary, problemId: string, dueSnapshot?: any): DailySummary {
  const wasRated = s.revisedToday.some((p) => p.id === problemId);
  const due =
    dueSnapshot && !s.due.some((p) => p.id === problemId) ? sortDue([...s.due, dueSnapshot]) : s.due;
  return {
    ...s,
    due,
    revisedToday: s.revisedToday.filter((p) => p.id !== problemId),
    streak: wasRated ? withReviewed(s.streak, Math.max(0, s.streak.todayReviewed - 1)) : s.streak,
  };
}

export function removeFromDue(s: DailySummary, problemId: string): DailySummary {
  return { ...s, due: s.due.filter((p) => p.id !== problemId) };
}
