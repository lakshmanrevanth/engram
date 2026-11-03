import { describe, it, expect } from 'vitest';
import { diffEditorForm, toEditorForm } from './editor-form';

const now = new Date(2026, 10, 3, 9, 0);
const lc = {
  id: 'p1', platform: 'LEETCODE', problemNumber: 1, title: 'Two Sum', url: 'https://leetcode.com/problems/two-sum/',
  difficulty: 'EASY', topic: 'Array', tags: ['Blind 75'], dateSolved: new Date(2026, 10, 1, 12).toISOString(), notes: null,
};

describe('editor form', () => {
  it('builds the form from a problem, including CF codes derived from the URL', () => {
    expect(toEditorForm(lc)).toMatchObject({ identifier: '1', solvedOn: '2026-11-01', notes: '', tags: ['Blind 75'] });
    expect(toEditorForm({ platform: 'CODEFORCES', problemNumber: 401, url: 'https://codeforces.com/problemset/problem/4/A' }).identifier).toBe('4A');
    expect(toEditorForm({ platform: 'LEETCODE', problemNumber: 345678 }).identifier).toBe('');
  });

  it('only sends changed fields', () => {
    const initial = toEditorForm(lc);
    expect(diffEditorForm(initial, initial, now)).toEqual({ patch: {} });
    const r = diffEditorForm(initial, { ...initial, title: ' Two Sum II ', tags: ['Blind 75', 'dp'] }, now);
    expect(r).toEqual({ patch: { title: 'Two Sum II', tags: ['Blind 75', 'dp'] } });
  });

  it('sends a solve date as local noon and rejects future dates', () => {
    const initial = toEditorForm(lc);
    const r = diffEditorForm(initial, { ...initial, solvedOn: '2026-10-20' }, now);
    expect('patch' in r && new Date(r.patch.dateSolved!).getHours()).toBe(12);
    expect(diffEditorForm(initial, { ...initial, solvedOn: '2026-11-04' }, now)).toEqual({ error: "Solve date can't be in the future" });
  });

  it('validates title, URL and identifiers', () => {
    const initial = toEditorForm(lc);
    expect('error' in diffEditorForm(initial, { ...initial, title: ' ' }, now)).toBe(true);
    expect('error' in diffEditorForm(initial, { ...initial, url: 'leetcode.com' }, now)).toBe(true);
    expect('error' in diffEditorForm(initial, { ...initial, identifier: 'abc' }, now)).toBe(true);
    expect(diffEditorForm(initial, { ...initial, identifier: '2' }, now)).toEqual({ patch: { problemNumber: 2 } });
  });

  it('switching to Codeforces sends the code and lets the server derive the number', () => {
    const initial = toEditorForm(lc);
    const r = diffEditorForm(initial, { ...initial, platform: 'CODEFORCES', identifier: '4a' }, now);
    expect(r).toEqual({ patch: { platform: 'CODEFORCES', code: '4A' } });
  });
});

describe('next review date in the editor', () => {
  const base = { title: 'T', url: 'https://x.dev', platform: 'LEETCODE', problemNumber: 1, status: 'ACTIVE' };
  it('sends nextRevisionOn only when it changes, and rejects past days', () => {
    const now = new Date(2026, 10, 3, 12);
    const initial = toEditorForm({ ...base, nextRevisionAt: new Date(2026, 10, 6, 9).toISOString() });
    expect(initial.nextReviewOn).toBe('2026-11-06');
    const moved = diffEditorForm(initial, { ...initial, nextReviewOn: '2026-11-20' }, now);
    expect('patch' in moved && moved.patch.nextRevisionOn).toBe('2026-11-20');
    const past = diffEditorForm(initial, { ...initial, nextReviewOn: '2026-11-01' }, now);
    expect('error' in past).toBe(true);
    const same = diffEditorForm(initial, initial, now);
    expect('patch' in same && same.patch.nextRevisionOn).toBeFalsy();
  });

  it('has no next review for retired problems', () => {
    expect(toEditorForm({ ...base, status: 'RETIRED', nextRevisionAt: new Date().toISOString() }).nextReviewOn).toBe('');
  });
});
