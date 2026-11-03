import { describe, it, expect } from 'vitest';
import {
  codeforcesNumericId,
  displayCode,
  initialScheduleFor,
  isHttpUrl,
  localDateInputToISO,
  normalizeCode,
  normalizeTags,
  parseSolvedDate,
  toLocalDateInput,
} from './problem-input';

describe('isHttpUrl', () => {
  it('accepts http and https only', () => {
    expect(isHttpUrl('https://leetcode.com/problems/two-sum/')).toBe(true);
    expect(isHttpUrl('http://example.com')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('ftp://x.com')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
    expect(isHttpUrl(42)).toBe(false);
  });
});

describe('normalizeTags', () => {
  it('trims, drops empties and case-insensitive duplicates', () => {
    expect(normalizeTags(['  DP ', 'dp', '', 'Blind 75'])).toEqual({ tags: ['DP', 'Blind 75'] });
  });
  it('rejects non-arrays, non-strings, too many and too long', () => {
    expect('error' in normalizeTags('dp')).toBe(true);
    expect('error' in normalizeTags([1])).toBe(true);
    expect('error' in normalizeTags(Array.from({ length: 11 }, (_, i) => `t${i}`))).toBe(true);
    expect('error' in normalizeTags(['x'.repeat(31)])).toBe(true);
    expect(normalizeTags(Array.from({ length: 10 }, (_, i) => `t${i}`))).toHaveProperty('tags');
  });
});

describe('parseSolvedDate', () => {
  const now = new Date('2026-11-03T10:00:00Z');
  it('accepts past dates and today', () => {
    expect(parseSolvedDate('2026-10-01T12:00:00Z', now)).toEqual({ date: new Date('2026-10-01T12:00:00Z') });
    expect('date' in parseSolvedDate(now.toISOString(), now)).toBe(true);
  });
  it('rejects future and invalid dates', () => {
    expect(parseSolvedDate('2026-11-05T10:00:00Z', now)).toEqual({ error: "Solve date can't be in the future" });
    expect('error' in parseSolvedDate('garbage', now)).toBe(true);
    expect('error' in parseSolvedDate({}, now)).toBe(true);
  });
});

describe('initialScheduleFor', () => {
  const now = new Date('2026-11-03T10:00:00Z');
  it('schedules from the solve date using the ladder', () => {
    const s = initialScheduleFor(new Date('2026-11-02T10:00:00Z'), [3, 7, 14, 30], now);
    expect(s.nextRevisionAt.toISOString()).toBe('2026-11-05T10:00:00.000Z');
    expect(s.currentStep).toBe(0);
    expect(s.status).toBe('ACTIVE');
  });
  it('uses a custom ladder', () => {
    const s = initialScheduleFor(now, [1, 2, 4, 8], now);
    expect(s.nextRevisionAt.toISOString()).toBe('2026-11-04T10:00:00.000Z');
  });
  it('never schedules in the past — an old solve is due today', () => {
    const s = initialScheduleFor(new Date('2026-09-01T10:00:00Z'), [3, 7, 14, 30], now);
    expect(s.nextRevisionAt.toISOString()).toBe(now.toISOString());
  });
});

describe('codes', () => {
  it('maps Codeforces codes to numbers', () => {
    expect(codeforcesNumericId('4A')).toBe(401);
    expect(codeforcesNumericId('1234c')).toBe(123403);
    expect(codeforcesNumericId('2254C1')).toBe(2254031);
    expect(codeforcesNumericId('2254C2')).toBe(2254032);
    expect(codeforcesNumericId('abc')).toBeNull();
  });
  it('normalizes codes', () => {
    expect(normalizeCode(' flow001 ')).toBe('FLOW001');
    expect(normalizeCode('https://x.com')).toBeNull();
    expect(normalizeCode('a b')).toBeNull();
    expect(normalizeCode(5)).toBeNull();
  });
  it('derives a display code from the stored code or URL', () => {
    expect(displayCode({ platform: 'CODEFORCES', code: '1234A' })).toBe('1234A');
    expect(displayCode({ platform: 'CODEFORCES', url: 'https://codeforces.com/problemset/problem/4/A' })).toBe('4A');
    expect(displayCode({ platform: 'CODEFORCES', url: 'https://codeforces.com/contest/1800/problem/c2' })).toBe('1800C2');
    expect(displayCode({ platform: 'CODECHEF', url: 'https://www.codechef.com/problems/FLOW001' })).toBe('FLOW001');
    expect(displayCode({ platform: 'LEETCODE', url: 'https://leetcode.com/problems/two-sum/' })).toBeNull();
  });
});

describe('local date input helpers', () => {
  it('round-trips today to now and past days to local noon', () => {
    const now = new Date(2026, 10, 3, 9, 30);
    expect(toLocalDateInput(now)).toBe('2026-11-03');
    expect(localDateInputToISO('2026-11-03', now)).toBe(now.toISOString());
    const past = new Date(localDateInputToISO('2026-10-31', now));
    expect([past.getFullYear(), past.getMonth(), past.getDate(), past.getHours()]).toEqual([2026, 9, 31, 12]);
  });
});
