// Pure aggregation for GET /api/stats. No database or framework access here:
// the route loads a few narrow rows and these functions turn them into the stats payload.
// Every day/week boundary is a local calendar day in the user's timezone.

import { dateKeyInTz, shiftDateKey } from '@/lib/dates';

export type Confidence = 'CLEAN' | 'SHAKY' | 'STRUGGLED';
export type Status = 'ACTIVE' | 'MASTERED' | 'RETIRED';
export type Kind = 'problem' | 'concept';

export type StatsProblemRow = {
  platform: string;
  status: Status;
  currentStep: number;
  nextRevisionAt: Date;
};

export type StatsRevisionRow = {
  revisedAt: Date;
  confidence: Confidence;
  problem: { platform: string; topic: string };
};

export type WeekPoint = {
  weekStart: string;
  reviews: number;
  clean: number;
  shaky: number;
  struggled: number;
  cleanRate: number | null;
};

export type WeakTopic = {
  topic: string;
  reviews: number;
  clean: number;
  shaky: number;
  struggled: number;
  cleanRate: number;
  struggleRate: number;
  kind: 'problem' | 'concept' | 'mixed';
};

export type UpcomingDay = { date: string; count: number; concepts: number };

export type KindStats = { items: number; reviews90: number; cleanRate90: number | null };

export type StatsPayload = {
  today: string;
  timeZone: string;
  ladderDays: number[];
  totals: {
    problems: number;
    concepts: number;
    active: number;
    mastered: number;
    retired: number;
    reviewsAllTime: number;
    reviewsLast30: number;
  };
  recallRate: WeekPoint[];
  overallCleanRate: number | null;
  previousCleanRate: number | null;
  /** overallCleanRate − previousCleanRate (fraction, e.g. 0.05 = +5 points); null when either side has no reviews. */
  cleanRateChange: number | null;
  reviewsLast90: number;
  weakestTopics: WeakTopic[];
  upcoming: UpcomingDay[];
  overdueCount: number;
  ladder: { steps: [number, number, number, number]; mastered: number };
  byKind: { problems: KindStats; concepts: KindStats };
};

export const WEEKS = 12;
export const UPCOMING_DAYS = 30;
export const RATE_WINDOW_DAYS = 90;
export const MIN_TOPIC_REVIEWS = 3;
export const MAX_WEAK_TOPICS = 8;

export const kindOf = (platform: string): Kind => (platform === 'SYSTEM_DESIGN' ? 'concept' : 'problem');

/** Monday of the week containing the "YYYY-MM-DD" key. */
export function mondayOf(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return shiftDateKey(key, -((dow + 6) % 7));
}

/** The earliest local day any stat needs revisions from (the route filters `revisedAt >= ` its start). */
export function revisionWindowStartKey(todayKey: string): string {
  const prevWindowStart = shiftDateKey(todayKey, -(2 * RATE_WINDOW_DAYS - 1));
  const firstWeek = shiftDateKey(mondayOf(todayKey), -7 * (WEEKS - 1));
  return prevWindowStart < firstWeek ? prevWindowStart : firstWeek;
}

const rate = (clean: number, total: number) => (total > 0 ? clean / total : null);

type Tally = { reviews: number; clean: number; shaky: number; struggled: number };
const emptyTally = (): Tally => ({ reviews: 0, clean: 0, shaky: 0, struggled: 0 });
function add(t: Tally, c: Confidence) {
  t.reviews++;
  if (c === 'CLEAN') t.clean++;
  else if (c === 'SHAKY') t.shaky++;
  else t.struggled++;
}

export type ComputeStatsInput = {
  now: Date;
  timeZone: string;
  ladderDays: readonly number[];
  problems: StatsProblemRow[];
  /** Revisions since revisionWindowStartKey(today) — older rows are ignored. */
  revisions: StatsRevisionRow[];
  reviewsAllTime: number;
};

export function computeStats(input: ComputeStatsInput): StatsPayload {
  const { now, timeZone: tz, problems, revisions } = input;
  const today = dateKeyInTz(now, tz);

  // ---- Totals + ladder ------------------------------------------------------
  const totals = { problems: 0, concepts: 0, active: 0, mastered: 0, retired: 0 };
  const steps: [number, number, number, number] = [0, 0, 0, 0];
  const items = { problem: 0, concept: 0 };
  for (const p of problems) {
    const kind = kindOf(p.platform);
    items[kind]++;
    if (kind === 'concept') totals.concepts++;
    else totals.problems++;
    if (p.status === 'ACTIVE') {
      totals.active++;
      steps[Math.min(3, Math.max(0, Math.trunc(p.currentStep) || 0))]++;
    } else if (p.status === 'MASTERED') totals.mastered++;
    else totals.retired++;
  }

  // ---- Upcoming load (ACTIVE + MASTERED rechecks; overdue lands on today) ----
  const lastUpcoming = shiftDateKey(today, UPCOMING_DAYS - 1);
  const upcoming: UpcomingDay[] = [];
  const upcomingIndex = new Map<string, UpcomingDay>();
  for (let i = 0; i < UPCOMING_DAYS; i++) {
    const day = { date: shiftDateKey(today, i), count: 0, concepts: 0 };
    upcoming.push(day);
    upcomingIndex.set(day.date, day);
  }
  let overdueCount = 0;
  for (const p of problems) {
    if (p.status === 'RETIRED') continue;
    let key = dateKeyInTz(p.nextRevisionAt, tz);
    if (key < today) {
      overdueCount++;
      key = today;
    }
    if (key > lastUpcoming) continue;
    const day = upcomingIndex.get(key);
    if (!day) continue;
    day.count++;
    if (kindOf(p.platform) === 'concept') day.concepts++;
  }

  // ---- Revisions: weekly series, 30/90-day windows, topics, kinds ----------
  const thisMonday = mondayOf(today);
  const recallRate: WeekPoint[] = [];
  const weekIndex = new Map<string, WeekPoint>();
  for (let i = WEEKS - 1; i >= 0; i--) {
    const w: WeekPoint = { weekStart: shiftDateKey(thisMonday, -7 * i), reviews: 0, clean: 0, shaky: 0, struggled: 0, cleanRate: null };
    recallRate.push(w);
    weekIndex.set(w.weekStart, w);
  }

  const start30 = shiftDateKey(today, -29);
  const start90 = shiftDateKey(today, -(RATE_WINDOW_DAYS - 1));
  const startPrev90 = shiftDateKey(today, -(2 * RATE_WINDOW_DAYS - 1));

  let reviewsLast30 = 0;
  const cur = emptyTally();
  const prev = emptyTally();
  const kinds = { problem: emptyTally(), concept: emptyTally() };
  const topics = new Map<string, Tally & { topic: string; kinds: Set<Kind> }>();

  for (const r of revisions) {
    const key = dateKeyInTz(r.revisedAt, tz);
    if (key > today) continue; // clock skew: ignore future rows

    const week = weekIndex.get(mondayOf(key));
    if (week) add(week, r.confidence);
    if (key >= start30) reviewsLast30++;

    if (key >= start90) {
      add(cur, r.confidence);
      const kind = kindOf(r.problem.platform);
      add(kinds[kind], r.confidence);

      const name = (r.problem.topic ?? '').trim();
      if (name) {
        const id = name.toLowerCase();
        let t = topics.get(id);
        if (!t) {
          t = { topic: name, kinds: new Set(), ...emptyTally() };
          topics.set(id, t);
        }
        add(t, r.confidence);
        t.kinds.add(kind);
      }
    } else if (key >= startPrev90) {
      add(prev, r.confidence);
    }
  }
  for (const w of recallRate) w.cleanRate = rate(w.clean, w.reviews);

  const overallCleanRate = rate(cur.clean, cur.reviews);
  const previousCleanRate = rate(prev.clean, prev.reviews);
  const cleanRateChange =
    overallCleanRate !== null && previousCleanRate !== null ? overallCleanRate - previousCleanRate : null;

  const weakestTopics: WeakTopic[] = [...topics.values()]
    .filter((t) => t.reviews >= MIN_TOPIC_REVIEWS)
    .map((t) => ({
      topic: t.topic,
      reviews: t.reviews,
      clean: t.clean,
      shaky: t.shaky,
      struggled: t.struggled,
      cleanRate: t.clean / t.reviews,
      struggleRate: (t.struggled + 0.5 * t.shaky) / t.reviews,
      kind: (t.kinds.size > 1 ? 'mixed' : [...t.kinds][0]) as WeakTopic['kind'],
    }))
    // A topic you recall cleanly every time isn't weak, so it never makes the list.
    .filter((t) => t.struggleRate > 0)
    .sort((a, b) => b.struggleRate - a.struggleRate || b.reviews - a.reviews || a.topic.localeCompare(b.topic))
    .slice(0, MAX_WEAK_TOPICS);

  return {
    today,
    timeZone: tz,
    ladderDays: [...input.ladderDays],
    totals: { ...totals, reviewsAllTime: input.reviewsAllTime, reviewsLast30 },
    recallRate,
    overallCleanRate,
    previousCleanRate,
    cleanRateChange,
    reviewsLast90: cur.reviews,
    weakestTopics,
    upcoming,
    overdueCount,
    ladder: { steps, mastered: totals.mastered },
    byKind: {
      problems: { items: items.problem, reviews90: kinds.problem.reviews, cleanRate90: rate(kinds.problem.clean, kinds.problem.reviews) },
      concepts: { items: items.concept, reviews90: kinds.concept.reviews, cleanRate90: rate(kinds.concept.clean, kinds.concept.reviews) },
    },
  };
}
