import { describe, it, expect } from 'vitest';
import { computeStreak } from './compute';

const counts = (entries: Record<string, number>) => new Map(Object.entries(entries));

describe('computeStreak', () => {
  const today = '2026-11-03';

  it('counts any day with a review by default', () => {
    const r = computeStreak({
      todayKey: today,
      countsByDay: counts({ '2026-11-01': 1, '2026-11-02': 2, '2026-11-03': 1 }),
      dailyGoal: 5,
      goalBasedStreak: false,
    });
    expect(r.currentStreak).toBe(3);
    expect(r.todayCompleted).toBe(true);
    expect(r.todayReviewed).toBe(1);
    expect(r.goalMet).toBe(false);
    expect(r.dailyGoal).toBe(5);
  });

  it('keeps yesterday’s streak alive until today is done', () => {
    const r = computeStreak({
      todayKey: today,
      countsByDay: counts({ '2026-11-01': 1, '2026-11-02': 1 }),
      dailyGoal: 3,
      goalBasedStreak: false,
    });
    expect(r.currentStreak).toBe(2);
    expect(r.todayCompleted).toBe(false);
  });

  it('only counts days that meet the goal when the streak is goal-based', () => {
    const r = computeStreak({
      todayKey: today,
      countsByDay: counts({ '2026-10-30': 3, '2026-10-31': 3, '2026-11-01': 1, '2026-11-02': 4, '2026-11-03': 2 }),
      loggedDays: ['2026-11-01'],
      dailyGoal: 3,
      goalBasedStreak: true,
    });
    // Nov 1 (1 review) breaks the run even though StreakLog marked it.
    expect(r.currentStreak).toBe(1);
    expect(r.bestStreak).toBe(2);
    expect(r.todayCompleted).toBe(false);
    expect(r.goalMet).toBe(false);
  });

  it('marks today complete once the goal is met', () => {
    const r = computeStreak({
      todayKey: today,
      countsByDay: counts({ '2026-11-02': 3, '2026-11-03': 3 }),
      dailyGoal: 3,
      goalBasedStreak: true,
    });
    expect(r.todayCompleted).toBe(true);
    expect(r.goalMet).toBe(true);
    expect(r.currentStreak).toBe(2);
  });

  it('uses StreakLog days when not goal-based', () => {
    const r = computeStreak({
      todayKey: today,
      countsByDay: counts({ '2026-11-03': 1 }),
      loggedDays: ['2026-11-02'],
      dailyGoal: 5,
      goalBasedStreak: false,
    });
    expect(r.currentStreak).toBe(2);
  });
});
