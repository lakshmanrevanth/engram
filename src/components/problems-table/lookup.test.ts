import { describe, it, expect, vi } from 'vitest';
import { findDuplicate, lookupProblem, manualPrefill } from './lookup';
import { mergeSuggestions, rankedDistinct, tagsFrom, topicsFrom } from './suggestions';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('lookupProblem', () => {
  it('returns found data from the resolver and drops the "General" topic', async () => {
    const f = vi.fn().mockResolvedValue(json({ found: true, data: { title: 'Two Sum', difficulty: 'EASY', topic: 'General', url: 'u', problemNumber: 1 } }));
    const r = await lookupProblem('LEETCODE', ' 1 ', f);
    expect(r).toEqual({ status: 'found', data: { title: 'Two Sum', difficulty: 'EASY', topic: '', url: 'u', problemNumber: 1, code: undefined } });
    expect(f).toHaveBeenCalledWith('/api/resolve/leetcode?id=1');
  });

  it('falls back to the LeetCode live lookup, then reports not found', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json({ found: false, reason: 'not_found' }))
      .mockResolvedValueOnce(json({ error: 'Problem not found' }, 404));
    expect(await lookupProblem('LEETCODE', '99999', f)).toEqual({ status: 'not_found' });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('uses the slug for LeetCode URLs', async () => {
    const f = vi.fn().mockResolvedValue(json({ title: 'Two Sum', difficulty: 'EASY', topic: 'Array', url: 'u', problemNumber: 1 }));
    const r = await lookupProblem('LEETCODE', 'https://leetcode.com/problems/two-sum/description/', f);
    expect(r.status).toBe('found');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ titleSlug: 'two-sum' });
  });

  it('separates a failed lookup from a miss', async () => {
    expect(await lookupProblem('CODEFORCES', '9999Z', vi.fn().mockResolvedValue(json({ found: false, reason: 'lookup_failed' }, 502))))
      .toMatchObject({ status: 'error' });
    expect(await lookupProblem('GFG', 'x', vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))))
      .toMatchObject({ status: 'error' });
    expect(await lookupProblem('GFG', 'x', vi.fn().mockResolvedValue(json({ found: false }))))
      .toEqual({ status: 'not_found' });
  });
});

describe('manualPrefill', () => {
  it('carries the URL, number or code into the manual draft', () => {
    expect(manualPrefill('GFG', 'https://www.geeksforgeeks.org/problems/x/1')).toEqual({ url: 'https://www.geeksforgeeks.org/problems/x/1' });
    expect(manualPrefill('LEETCODE', '3999')).toEqual({ url: '', problemNumber: 3999 });
    expect(manualPrefill('CODEFORCES', '2300a')).toEqual({ url: '', code: '2300A' });
    expect(manualPrefill('GFG', 'two words')).toEqual({ url: '' });
  });
});

describe('findDuplicate', () => {
  const problems = [
    { id: 'a', platform: 'LEETCODE', problemNumber: 1, title: 'Two Sum', url: 'https://leetcode.com/problems/two-sum/' },
    { id: 'b', platform: 'CODEFORCES', problemNumber: 401, code: '4A', title: 'Watermelon', url: 'x' },
  ];
  it('matches by number, code or URL on the same platform', () => {
    expect(findDuplicate(problems, 'LEETCODE', { problemNumber: 1 })?.id).toBe('a');
    expect(findDuplicate(problems, 'CODEFORCES', { code: '4a' })?.id).toBe('b');
    expect(findDuplicate(problems, 'LEETCODE', { url: 'https://leetcode.com/problems/two-sum' })?.id).toBe('a');
    expect(findDuplicate(problems, 'GFG', { problemNumber: 1 })).toBeNull();
    expect(findDuplicate(undefined, 'GFG', {})).toBeNull();
  });
});

describe('suggestions', () => {
  it('ranks distinct values by use and keeps the common spelling', () => {
    expect(rankedDistinct(['DP', 'dp', 'DP', 'Graph', '', 'graph '])).toEqual(['DP', 'Graph']);
  });
  it('puts user topics before defaults without case duplicates', () => {
    expect(mergeSuggestions(['dynamic programming', 'DP'], ['Array', 'Dynamic Programming'])).toEqual(['dynamic programming', 'DP', 'Array']);
  });
  it('derives topics and tags from problems', () => {
    const ps = [{ topic: 'Graph', tags: ['Blind 75'] }, { topic: 'Graph', tags: ['blind 75', 'NeetCode'] }, { topic: '' }];
    expect(topicsFrom(ps)).toEqual(['Graph']);
    expect(tagsFrom(ps)).toEqual(['Blind 75', 'NeetCode']);
  });
});
