import { describe, it, expect } from 'vitest';
import {
  computeStats,
  mondayOf,
  revisionWindowStartKey,
  type Confidence,
  type StatsProblemRow,
  type StatsRevisionRow,
} from './compute';

// 2026-11-03 is a Tuesday. 12:00 UTC = 17:30 in Asia/Kolkata.
const NOW = new Date('2026-11-03T12:00:00Z');
const LADDER = [3, 7, 14, 30];

const at = (iso: string) => new Date(iso);
const rev = (iso: string, confidence: Confidence, topic = 'Arrays', platform = 'LEETCODE'): StatsRevisionRow => ({
  revisedAt: at(iso),
  confidence,
  problem: { platform, topic },
});
const prob = (p: Partial<StatsProblemRow> & { nextRevisionAt: Date }): StatsProblemRow => ({
  platform: 'LEETCODE',
  status: 'ACTIVE',
  currentStep: 0,
  ...p,
});

const run = (problems: StatsProblemRow[], revisions: StatsRevisionRow[], timeZone = 'UTC', reviewsAllTime = revisions.length) =>
  computeStats({ now: NOW, timeZone, ladderDays: LADDER, problems, revisions, reviewsAllTime });

describe('week helpers', () => {
  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-11-03')).toBe('2026-11-02'); // Tue
    expect(mondayOf('2026-11-02')).toBe('2026-11-02'); // Mon
    expect(mondayOf('2026-11-08')).toBe('2026-11-02'); // Sun
    expect(mondayOf('2026-03-01')).toBe('2026-02-23'); // across a month
  });

  it('starts the revision window at the earlier of 180 days and 12 weeks', () => {
    expect(revisionWindowStartKey('2026-11-03')).toBe('2026-05-08'); // today − 179
  });
});

describe('computeStats', () => {
  it('is all zeros and nulls for a user with no data', () => {
    const s = run([], []);
    expect(s.today).toBe('2026-11-03');
    expect(s.totals).toEqual({ problems: 0, concepts: 0, active: 0, mastered: 0, retired: 0, reviewsAllTime: 0, reviewsLast30: 0 });
    expect(s.recallRate).toHaveLength(12);
    expect(s.recallRate[11].weekStart).toBe('2026-11-02');
    expect(s.recallRate[0].weekStart).toBe('2026-08-17');
    expect(s.recallRate.every((w) => w.reviews === 0 && w.cleanRate === null)).toBe(true);
    expect(s.overallCleanRate).toBeNull();
    expect(s.cleanRateChange).toBeNull();
    expect(s.weakestTopics).toEqual([]);
    expect(s.upcoming).toHaveLength(30);
    expect(s.upcoming[0]).toEqual({ date: '2026-11-03', count: 0, concepts: 0 });
    expect(s.upcoming[29].date).toBe('2026-12-02');
    expect(s.overdueCount).toBe(0);
    expect(s.ladder).toEqual({ steps: [0, 0, 0, 0], mastered: 0 });
    expect(s.byKind.problems).toEqual({ items: 0, reviews90: 0, cleanRate90: null });
    expect(s.byKind.concepts).toEqual({ items: 0, reviews90: 0, cleanRate90: null });
  });

  it('counts totals by kind and status, and the ladder by step', () => {
    const next = at('2026-11-10T00:00:00Z');
    const s = run(
      [
        prob({ currentStep: 0, nextRevisionAt: next }),
        prob({ currentStep: 0, nextRevisionAt: next }),
        prob({ currentStep: 2, nextRevisionAt: next }),
        prob({ currentStep: 3, platform: 'SYSTEM_DESIGN', nextRevisionAt: next }),
        prob({ currentStep: 9, nextRevisionAt: next }), // out-of-range step clamps to 3
        prob({ status: 'MASTERED', currentStep: 3, nextRevisionAt: next }),
        prob({ status: 'RETIRED', platform: 'SYSTEM_DESIGN', nextRevisionAt: next }),
      ],
      [],
      'UTC',
      42,
    );
    expect(s.totals).toMatchObject({ problems: 5, concepts: 2, active: 5, mastered: 1, retired: 1, reviewsAllTime: 42 });
    expect(s.ladder).toEqual({ steps: [2, 0, 1, 2], mastered: 1 });
    expect(s.byKind.problems.items).toBe(5);
    expect(s.byKind.concepts.items).toBe(2);
  });

  it('buckets the next 30 local days, folds overdue onto today and skips retired items', () => {
    const s = run(
      [
        prob({ nextRevisionAt: at('2026-10-20T10:00:00Z') }), // overdue
        prob({ nextRevisionAt: at('2026-11-02T23:00:00Z'), platform: 'SYSTEM_DESIGN' }), // overdue concept
        prob({ nextRevisionAt: at('2026-11-03T20:00:00Z') }), // later today: due, not overdue
        prob({ nextRevisionAt: at('2026-11-05T08:00:00Z'), platform: 'SYSTEM_DESIGN' }),
        prob({ nextRevisionAt: at('2026-11-05T09:00:00Z'), status: 'MASTERED' }), // recheck counts
        prob({ nextRevisionAt: at('2026-12-02T12:00:00Z') }), // last day in range
        prob({ nextRevisionAt: at('2026-12-03T12:00:00Z') }), // beyond the window
        prob({ nextRevisionAt: at('2026-11-04T12:00:00Z'), status: 'RETIRED' }),
      ],
      [],
    );
    expect(s.overdueCount).toBe(2);
    expect(s.upcoming[0]).toEqual({ date: '2026-11-03', count: 3, concepts: 1 });
    expect(s.upcoming[1]).toEqual({ date: '2026-11-04', count: 0, concepts: 0 });
    expect(s.upcoming[2]).toEqual({ date: '2026-11-05', count: 2, concepts: 1 });
    expect(s.upcoming[29]).toEqual({ date: '2026-12-02', count: 1, concepts: 0 });
    expect(s.upcoming.reduce((n, d) => n + d.count, 0)).toBe(6);
  });

  it('uses the user’s timezone for day and week boundaries', () => {
    // 2026-11-01T20:00Z is Sunday in UTC but Monday 01:30 in Kolkata.
    const revisions = [rev('2026-11-01T20:00:00Z', 'CLEAN')];
    expect(run([], revisions, 'UTC').recallRate[10].reviews).toBe(1); // week of Oct 26
    const ist = run([], revisions, 'Asia/Kolkata');
    expect(ist.recallRate[11].weekStart).toBe('2026-11-02');
    expect(ist.recallRate[11].reviews).toBe(1);

    // Due at 2026-11-03T19:00Z: still "today" in UTC, already Nov 4 in Kolkata.
    const p = [prob({ nextRevisionAt: at('2026-11-03T19:00:00Z') })];
    expect(run(p, [], 'UTC').upcoming[0].count).toBe(1);
    expect(run(p, [], 'Asia/Kolkata').upcoming[1]).toEqual({ date: '2026-11-04', count: 1, concepts: 0 });

    // 05:00 UTC on Nov 3 is still Monday Nov 2 (21:00) in Los Angeles.
    const la = computeStats({ now: at('2026-11-03T05:00:00Z'), timeZone: 'America/Los_Angeles', ladderDays: LADDER, problems: [], revisions: [], reviewsAllTime: 0 });
    expect(la.today).toBe('2026-11-02');
    expect(la.recallRate[11].weekStart).toBe('2026-11-02');
  });

  it('builds the weekly recall series with clean rate per week', () => {
    const s = run(
      [],
      [
        rev('2026-11-02T09:00:00Z', 'CLEAN'),
        rev('2026-11-03T09:00:00Z', 'SHAKY'),
        rev('2026-11-03T10:00:00Z', 'STRUGGLED'),
        rev('2026-11-03T11:00:00Z', 'CLEAN'),
        rev('2026-10-27T09:00:00Z', 'CLEAN'),
        rev('2026-08-17T09:00:00Z', 'STRUGGLED'), // first week in the series
        rev('2026-08-16T09:00:00Z', 'CLEAN'), // before the series (still in the 90-day window)
      ],
    );
    const last = s.recallRate[11];
    expect(last).toEqual({ weekStart: '2026-11-02', reviews: 4, clean: 2, shaky: 1, struggled: 1, cleanRate: 0.5 });
    expect(s.recallRate[10]).toMatchObject({ weekStart: '2026-10-26', reviews: 1, cleanRate: 1 });
    expect(s.recallRate[9]).toMatchObject({ reviews: 0, cleanRate: null });
    expect(s.recallRate[0]).toMatchObject({ weekStart: '2026-08-17', reviews: 1, struggled: 1, cleanRate: 0 });
    expect(s.recallRate.reduce((n, w) => n + w.reviews, 0)).toBe(6);
  });

  it('computes the 30-day count and the 90-day clean rate with its change', () => {
    const s = run(
      [],
      [
        // Last 30 days (Oct 5 – Nov 3)
        rev('2026-11-03T08:00:00Z', 'CLEAN'),
        rev('2026-10-05T08:00:00Z', 'CLEAN'),
        // 31–90 days ago (Aug 6 – Oct 4)
        rev('2026-10-04T08:00:00Z', 'SHAKY'),
        rev('2026-08-06T08:00:00Z', 'CLEAN'),
        // Previous 90 days (May 8 – Aug 5)
        rev('2026-08-05T08:00:00Z', 'STRUGGLED'),
        rev('2026-06-01T08:00:00Z', 'CLEAN'),
        rev('2026-05-08T08:00:00Z', 'STRUGGLED'),
        rev('2026-05-07T08:00:00Z', 'CLEAN'), // older than both windows
      ],
      'UTC',
      100,
    );
    expect(s.totals.reviewsLast30).toBe(2);
    expect(s.totals.reviewsAllTime).toBe(100);
    expect(s.reviewsLast90).toBe(4);
    expect(s.overallCleanRate).toBe(0.75);
    expect(s.previousCleanRate).toBeCloseTo(1 / 3);
    expect(s.cleanRateChange).toBeCloseTo(0.75 - 1 / 3);
  });

  it('leaves the change null when the previous window is empty', () => {
    const s = run([], [rev('2026-11-01T08:00:00Z', 'CLEAN')]);
    expect(s.overallCleanRate).toBe(1);
    expect(s.previousCleanRate).toBeNull();
    expect(s.cleanRateChange).toBeNull();
  });

  it('ranks weakest topics by struggle share with a minimum of 3 reviews', () => {
    const d = '2026-10-20T08:00:00Z';
    const revisions: StatsRevisionRow[] = [
      // Graphs: 2 struggled + 1 shaky + 1 clean → (2 + 0.5)/4 = 0.625
      rev(d, 'STRUGGLED', 'Graphs'), rev(d, 'STRUGGLED', 'graphs '), rev(d, 'SHAKY', 'Graphs'), rev(d, 'CLEAN', 'Graphs'),
      // DP: 3 shaky → 0.5
      rev(d, 'SHAKY', 'DP'), rev(d, 'SHAKY', 'DP'), rev(d, 'SHAKY', 'DP'),
      // Caching (concept + problem) → mixed: 1 struggled, 2 clean → 1/3
      rev(d, 'STRUGGLED', 'Caching', 'SYSTEM_DESIGN'), rev(d, 'CLEAN', 'Caching', 'SYSTEM_DESIGN'), rev(d, 'CLEAN', 'Caching'),
      // Path concept topic: 1 shaky + 5 clean → 1/12
      rev(d, 'SHAKY', 'Distributed Systems', 'SYSTEM_DESIGN'),
      ...Array.from({ length: 5 }, () => rev(d, 'CLEAN', 'Distributed Systems', 'SYSTEM_DESIGN')),
      // Too few reviews
      rev(d, 'STRUGGLED', 'Tries'), rev(d, 'STRUGGLED', 'Tries'),
      // Always clean → not weak
      rev(d, 'CLEAN', 'Strings'), rev(d, 'CLEAN', 'Strings'), rev(d, 'CLEAN', 'Strings'),
      // Weak but outside the 90-day window
      rev('2026-07-01T08:00:00Z', 'STRUGGLED', 'Heaps'), rev('2026-07-01T08:00:00Z', 'STRUGGLED', 'Heaps'), rev('2026-07-01T08:00:00Z', 'STRUGGLED', 'Heaps'),
      // Blank topic is skipped
      rev(d, 'STRUGGLED', '  '), rev(d, 'STRUGGLED', ''), rev(d, 'STRUGGLED', ''),
    ];
    const s = run([], revisions);
    expect(s.weakestTopics.map((t) => t.topic)).toEqual(['Graphs', 'DP', 'Caching', 'Distributed Systems']);
    expect(s.weakestTopics[0]).toEqual({
      topic: 'Graphs', reviews: 4, clean: 1, shaky: 1, struggled: 2, cleanRate: 0.25, struggleRate: 0.625, kind: 'problem',
    });
    expect(s.weakestTopics[2].kind).toBe('mixed');
    expect(s.weakestTopics[3].kind).toBe('concept');
    expect(s.weakestTopics[3].struggleRate).toBeCloseTo(1 / 12);
  });

  it('caps the weakest topics at 8, breaking ties by review count', () => {
    const d = '2026-10-20T08:00:00Z';
    const revisions: StatsRevisionRow[] = [];
    for (let i = 0; i < 10; i++) {
      const n = 3 + i; // more reviews for later topics, all fully struggled
      for (let k = 0; k < n; k++) revisions.push(rev(d, 'STRUGGLED', `Topic ${i}`));
    }
    const s = run([], revisions);
    expect(s.weakestTopics).toHaveLength(8);
    expect(s.weakestTopics[0].topic).toBe('Topic 9');
    expect(s.weakestTopics[7].topic).toBe('Topic 2');
  });

  it('splits 90-day reviews by problems vs concepts', () => {
    const d = '2026-10-20T08:00:00Z';
    const s = run(
      [],
      [rev(d, 'CLEAN'), rev(d, 'SHAKY'), rev(d, 'CLEAN', 'Caching', 'SYSTEM_DESIGN'), rev('2026-06-01T08:00:00Z', 'CLEAN', 'Caching', 'SYSTEM_DESIGN')],
    );
    expect(s.byKind.problems).toMatchObject({ reviews90: 2, cleanRate90: 0.5 });
    expect(s.byKind.concepts).toMatchObject({ reviews90: 1, cleanRate90: 1 });
  });

  it('handles a realistic history consistently', () => {
    // 150 days of reviews, 0–4 a day, deterministic pseudo-random confidences.
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const topicsList = ['Arrays', 'Graphs', 'DP', 'Trees', 'Caching', 'Sharding'];
    const revisions: StatsRevisionRow[] = [];
    for (let day = 0; day < 150; day++) {
      const n = Math.floor(rnd() * 5);
      for (let k = 0; k < n; k++) {
        const x = rnd();
        const topic = topicsList[Math.floor(rnd() * topicsList.length)];
        const platform = topic === 'Caching' || topic === 'Sharding' ? 'SYSTEM_DESIGN' : 'LEETCODE';
        revisions.push(rev(new Date(NOW.getTime() - day * 86400000 - k * 60000).toISOString(), x < 0.6 ? 'CLEAN' : x < 0.85 ? 'SHAKY' : 'STRUGGLED', topic, platform));
      }
    }
    const s = run([], revisions, 'Asia/Kolkata', revisions.length);
    const weekly = s.recallRate.reduce((n, w) => n + w.reviews, 0);
    expect(weekly).toBeGreaterThan(0);
    for (const w of s.recallRate) {
      expect(w.clean + w.shaky + w.struggled).toBe(w.reviews);
      if (w.reviews) expect(w.cleanRate).toBeCloseTo(w.clean / w.reviews);
    }
    expect(s.byKind.problems.reviews90 + s.byKind.concepts.reviews90).toBe(s.reviewsLast90);
    expect(s.totals.reviewsLast30).toBeLessThanOrEqual(s.reviewsLast90);
    const rates = s.weakestTopics.map((t) => t.struggleRate);
    expect([...rates].sort((a, b) => b - a)).toEqual(rates);
    expect(s.weakestTopics.length).toBeLessThanOrEqual(6);
  });
});
