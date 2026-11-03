import { describe, it, expect } from 'vitest';
import { nextIntervalLabel, describeInterval } from './intervals';
import { isTypingTarget, isPlainShortcut, isUndoChord } from './keyboard';
import { applyDailyRating, applyDailyUndo, removeFromDue, type DailySummary } from './summary-state';
import { describeUpcoming } from './all-done';
import { cellLabel } from '@/components/heatmap';

describe('nextIntervalLabel', () => {
  const today = new Date('2026-11-03T10:00:00Z');

  it('uses the default ladder', () => {
    const p = { status: 'ACTIVE', currentStep: 1 };
    expect(nextIntervalLabel(p, 'CLEAN', undefined, today)).toBe('14d');
    expect(nextIntervalLabel(p, 'SHAKY', undefined, today)).toBe('7d');
    expect(nextIntervalLabel(p, 'STRUGGLED', undefined, today)).toBe('3d');
  });

  it('uses the user ladder', () => {
    const p = { status: 'ACTIVE', currentStep: 1 };
    const ladder = [1, 2, 4, 8];
    expect(nextIntervalLabel(p, 'CLEAN', ladder, today)).toBe('4d');
    expect(nextIntervalLabel(p, 'SHAKY', ladder, today)).toBe('2d');
    expect(nextIntervalLabel(p, 'STRUGGLED', ladder, today)).toBe('1d');
  });

  it('shows mastered at the top of the ladder and recheck rules for mastered problems', () => {
    expect(nextIntervalLabel({ status: 'ACTIVE', currentStep: 3 }, 'CLEAN', null, today)).toBe('mastered');
    expect(nextIntervalLabel({ status: 'MASTERED', currentStep: 3 }, 'SHAKY', [2, 5, 10, 20], today)).toBe('5d');
  });

  it('describes intervals in words', () => {
    expect(describeInterval('1d')).toBe('back tomorrow');
    expect(describeInterval('7d')).toBe('back in 7 days');
    expect(describeInterval('mastered')).toBe('marks it mastered');
  });
});

describe('keyboard guards', () => {
  const input = { tagName: 'INPUT' } as unknown as EventTarget;
  const div = { tagName: 'DIV' } as unknown as EventTarget;
  const editable = { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget;

  it('ignores keys typed into fields', () => {
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(div)).toBe(false);
    expect(isPlainShortcut({ key: 'j', target: input })).toBe(false);
  });

  it('ignores keys with modifiers', () => {
    expect(isPlainShortcut({ key: '1', target: div })).toBe(true);
    expect(isPlainShortcut({ key: '1', ctrlKey: true, target: div })).toBe(false);
    expect(isPlainShortcut({ key: '1', metaKey: true, target: div })).toBe(false);
    expect(isPlainShortcut({ key: '1', altKey: true, target: div })).toBe(false);
  });

  it('recognises Ctrl/Cmd+Z but not redo', () => {
    expect(isUndoChord({ key: 'z', ctrlKey: true })).toBe(true);
    expect(isUndoChord({ key: 'Z', metaKey: true })).toBe(true);
    expect(isUndoChord({ key: 'z', ctrlKey: true, shiftKey: true })).toBe(false);
    expect(isUndoChord({ key: 'z' })).toBe(false);
  });
});

describe('summary optimistic updates', () => {
  const base = (): DailySummary => ({
    today: '2026-11-03',
    due: [
      { id: 'a', title: 'A', currentStep: 0, daysOverdue: 2 },
      { id: 'b', title: 'B', currentStep: 1, daysOverdue: 0 },
    ],
    revisedToday: [],
    streak: { currentStreak: 4, bestStreak: 4, todayCompleted: false, todayReviewed: 0, dailyGoal: 2, goalMet: false, goalBasedStreak: false },
    counts: { total: 5, mastered: 1 },
    ladder: [3, 7, 14, 30],
    upcoming: null,
  });

  it('moves a rated problem to completed and bumps the streak once', () => {
    const s0 = base();
    const s1 = applyDailyRating(s0, s0.due[0], 'CLEAN');
    expect(s1.due.map((p) => p.id)).toEqual(['b']);
    expect(s1.revisedToday[0]).toMatchObject({ id: 'a', latestRevision: { confidence: 'CLEAN' } });
    expect(s1.streak).toMatchObject({ todayReviewed: 1, todayCompleted: true, currentStreak: 5, bestStreak: 5, goalMet: false });

    // Second call with the server response fills in the revision id without counting twice.
    const s2 = applyDailyRating(s1, s0.due[0], 'CLEAN', { id: 'a', currentStep: 1, revisionId: 'rev-9' });
    expect(s2.streak.todayReviewed).toBe(1);
    expect(s2.revisedToday).toHaveLength(1);
    expect(s2.revisedToday[0].latestRevision).toMatchObject({ id: 'rev-9', stepAfter: 1 });
    expect(s2.revisedToday[0].revisionId).toBeUndefined();
  });

  it('only completes a goal-based day when the goal is met', () => {
    const s0 = { ...base(), streak: { ...base().streak, goalBasedStreak: true } };
    const s1 = applyDailyRating(s0, s0.due[0], 'SHAKY');
    expect(s1.streak).toMatchObject({ todayCompleted: false, currentStreak: 4 });
    const s2 = applyDailyRating(s1, s0.due[1], 'CLEAN');
    expect(s2.streak).toMatchObject({ todayCompleted: true, currentStreak: 5, goalMet: true });
  });

  it('undo puts the row back in the right place and rolls back the streak', () => {
    const s0 = base();
    const snapshot = s0.due[0];
    const s1 = applyDailyRating(s0, snapshot, 'STRUGGLED');
    const s2 = applyDailyUndo(s1, 'a', snapshot);
    expect(s2.due.map((p) => p.id)).toEqual(['a', 'b']);
    expect(s2.revisedToday).toEqual([]);
    expect(s2.streak).toMatchObject({ todayReviewed: 0, todayCompleted: false, currentStreak: 4 });
  });

  it('removeFromDue drops a snoozed or retired row', () => {
    expect(removeFromDue(base(), 'b').due.map((p) => p.id)).toEqual(['a']);
  });
});

describe('describeUpcoming', () => {
  it('names tomorrow and later days', () => {
    expect(describeUpcoming({ date: '2026-11-04', count: 4 }, '2026-11-03')).toBe('Next: 4 problems tomorrow');
    expect(describeUpcoming({ date: '2026-11-04', count: 1 }, '2026-11-03')).toBe('Next: 1 problem tomorrow');
    expect(describeUpcoming({ date: '2026-11-06', count: 2 }, '2026-11-03')).toBe('Next: 2 problems on Friday, Nov 6');
    expect(describeUpcoming({ date: '2026-12-01', count: 2 }, '2026-11-30')).toBe('Next: 2 problems tomorrow');
    expect(describeUpcoming(null, '2026-11-03')).toBeNull();
  });
});

describe('heatmap cellLabel', () => {
  it('reads like a sentence', () => {
    expect(cellLabel(3, '2026-11-02')).toBe('3 reviews on Nov 2, 2026');
    expect(cellLabel(1, '2026-11-02')).toBe('1 review on Nov 2, 2026');
    expect(cellLabel(0, '2026-11-02')).toBe('No reviews on Nov 2, 2026');
  });
});
