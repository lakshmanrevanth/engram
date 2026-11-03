// Streak rules shared by /api/streak and /api/daily/summary.

import { prisma } from '@/lib/prisma';
import { dateKeyInTz, shiftDateKey } from '@/lib/dates';

export type StreakSummary = {
  currentStreak: number;
  bestStreak: number;
  todayCompleted: boolean;
  todayReviewed: number;
  dailyGoal: number;
  goalMet: boolean;
  goalBasedStreak: boolean;
};

type ComputeInput = {
  todayKey: string;
  /** Revisions per local day, "YYYY-MM-DD" → count. */
  countsByDay: Map<string, number>;
  /** Days marked complete in StreakLog (ignored when the streak is goal-based). */
  loggedDays?: Iterable<string>;
  dailyGoal: number;
  goalBasedStreak: boolean;
};

/** Pure: a day counts when it has a review, or (goal-based) when reviews >= dailyGoal. */
export function computeStreak(input: ComputeInput): StreakSummary {
  const { todayKey, countsByDay, dailyGoal, goalBasedStreak } = input;
  const threshold = goalBasedStreak ? Math.max(1, dailyGoal) : 1;

  const activeDates = new Set<string>();
  for (const [key, n] of countsByDay) if (n >= threshold) activeDates.add(key);
  if (!goalBasedStreak) for (const key of input.loggedDays ?? []) activeDates.add(key);

  const todayReviewed = countsByDay.get(todayKey) ?? 0;
  const todayCompleted = activeDates.has(todayKey);

  // Count back from today, or from yesterday if today isn't done yet.
  let currentStreak = 0;
  let cursor = todayCompleted ? todayKey : shiftDateKey(todayKey, -1);
  while (activeDates.has(cursor)) {
    currentStreak++;
    cursor = shiftDateKey(cursor, -1);
  }

  let bestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of [...activeDates].sort()) {
    run = prev && shiftDateKey(prev, 1) === key ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    prev = key;
  }

  return {
    currentStreak,
    bestStreak,
    todayCompleted,
    todayReviewed,
    dailyGoal,
    goalMet: todayReviewed >= dailyGoal,
    goalBasedStreak,
  };
}

export async function getStreakSummary(
  userId: string,
  tz: string,
  prefs: { dailyGoal: number; goalBasedStreak: boolean },
  now = new Date()
): Promise<StreakSummary> {
  const [logs, revisions] = await Promise.all([
    prefs.goalBasedStreak
      ? Promise.resolve([] as { date: Date }[])
      : prisma.streakLog.findMany({ where: { userId, completed: true }, select: { date: true } }),
    prisma.revision.findMany({ where: { problem: { userId } }, select: { revisedAt: true } }),
  ]);

  const countsByDay = new Map<string, number>();
  for (const r of revisions) {
    const key = dateKeyInTz(r.revisedAt, tz);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  return computeStreak({
    todayKey: dateKeyInTz(now, tz),
    countsByDay,
    loggedDays: logs.map((l) => l.date.toISOString().slice(0, 10)),
    dailyGoal: prefs.dailyGoal,
    goalBasedStreak: prefs.goalBasedStreak,
  });
}
