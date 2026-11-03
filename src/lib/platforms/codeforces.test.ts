import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { codeforcesResolver, _resetCodeforcesLiveCache, ratingToDifficulty, parseCodeforcesIdentifier } from './codeforces';

const liveResponse = {
  status: 'OK',
  result: {
    problems: [
      { contestId: 9999, index: 'B', name: 'Brand New', rating: 1500, tags: ['greedy', 'math'] },
      { contestId: 9999, index: 'C1', name: 'Split Easy', tags: [] },
    ],
  },
};

describe('Codeforces resolver', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    _resetCodeforcesLiveCache();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(liveResponse), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves problem 4A (Watermelon)', async () => {
    const result = await codeforcesResolver.resolve('4A');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.data.title).toBe('Watermelon');
      expect(result.data.difficulty).toBe('EASY');
      expect(result.data.url).toBe('https://codeforces.com/problemset/problem/4/A');
      expect(result.data.problemNumber).toBe(401);
      expect(result.data.code).toBe('4A');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves problem case-insensitively (4a)', async () => {
    const result = await codeforcesResolver.resolve('4a');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.data.title).toBe('Watermelon');
    }
  });

  it('resolves problem 158A (Next Round)', async () => {
    const result = await codeforcesResolver.resolve('158A');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.data.title).toBe('Next Round');
      expect(result.data.difficulty).toBe('EASY');
    }
  });

  it('resolves problem by numeric ID (401)', async () => {
    const result = await codeforcesResolver.resolve('401');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.data.title).toBe('Watermelon');
    }
  });

  it('resolves a problem URL', async () => {
    const result = await codeforcesResolver.resolve('https://codeforces.com/contest/4/problem/A');
    expect(result.found).toBe(true);
  });

  it('falls back to the live API for codes missing from the dataset, and caches it', async () => {
    const result = await codeforcesResolver.resolve('9999b');
    expect(result).toEqual({
      found: true,
      data: {
        title: 'Brand New',
        difficulty: 'MEDIUM',
        topic: 'greedy',
        url: 'https://codeforces.com/problemset/problem/9999/B',
        problemNumber: 999902,
        code: '9999B',
      },
    });
    const second = await codeforcesResolver.resolve('9999C1');
    expect(second.found).toBe(true);
    if (second.found) expect(second.data.problemNumber).toBe(9999031);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns not_found for a code missing from both sources', async () => {
    const result = await codeforcesResolver.resolve('999999Z');
    expect(result).toEqual({ found: false, reason: 'not_found' });
  });

  it('reports lookup_failed when the live API is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await codeforcesResolver.resolve('9999B');
    expect(result).toEqual({ found: false, reason: 'lookup_failed' });
  });

  it('reports lookup_failed on a non-OK API payload', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'FAILED' }), { status: 200 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await codeforcesResolver.resolve('9999B');
    expect(result).toEqual({ found: false, reason: 'lookup_failed' });
  });
});

describe('Codeforces helpers', () => {
  it('maps ratings to difficulty', () => {
    expect(ratingToDifficulty(800)).toBe('EASY');
    expect(ratingToDifficulty(1200)).toBe('MEDIUM');
    expect(ratingToDifficulty(1800)).toBe('HARD');
    expect(ratingToDifficulty(undefined)).toBe('MEDIUM');
  });
  it('parses identifiers', () => {
    expect(parseCodeforcesIdentifier(' 1234a ')).toBe('1234A');
    expect(parseCodeforcesIdentifier('https://codeforces.com/problemset/problem/1234/C2')).toBe('1234C2');
  });
});
