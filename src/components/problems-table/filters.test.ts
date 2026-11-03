import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STATE,
  clearFilters,
  filterProblems,
  formatNextReview,
  hasActiveFilters,
  isDueThisWeek,
  isOverdue,
  matchesSearch,
  nextReviewAfterToday,
  parseTableState,
  serializeTableState,
  sortProblems,
  topicOptions,
  visibleLimitFor,
  type TableState,
} from './filters';

const now = new Date(2026, 10, 3, 12, 0, 0); // Nov 3 2026, local noon
const day = (offset: number, hour = 9) => new Date(2026, 10, 3 + offset, hour).toISOString();

const problems = [
  { id: 'a', title: 'Two Sum', problemNumber: 1, platform: 'LEETCODE', difficulty: 'EASY', status: 'ACTIVE', topic: 'Arrays', tags: ['Hash Map'], notes: 'use a map', isFavorite: true, nextRevisionAt: day(-2), dateSolved: day(-10) },
  { id: 'b', title: 'Watermelon', problemNumber: 0, code: '4A', platform: 'CODEFORCES', difficulty: 'EASY', status: 'ACTIVE', topic: 'Math', tags: [], notes: null, isFavorite: false, nextRevisionAt: day(0, 20), dateSolved: day(-5) },
  { id: 'c', title: 'LRU Cache', problemNumber: 146, platform: 'LEETCODE', difficulty: 'MEDIUM', status: 'ACTIVE', topic: 'Design', tags: ['hash map', 'Linked List'], notes: '', isFavorite: false, nextRevisionAt: day(5), dateSolved: day(-3) },
  { id: 'd', title: 'Old one', problemNumber: 9, platform: 'LEETCODE', difficulty: 'HARD', status: 'RETIRED', topic: 'DP', tags: [], notes: '', isFavorite: false, nextRevisionAt: day(-30), dateSolved: day(-60) },
  { id: 'e', title: 'Mastered', problemNumber: 20, platform: 'GFG', difficulty: 'MEDIUM', status: 'MASTERED', topic: 'Stack', tags: [], notes: '', isFavorite: false, nextRevisionAt: day(40), dateSolved: day(-100) },
];

const run = (patch: Partial<TableState>, listMembers?: Map<string, Set<string>>) =>
  filterProblems(problems, { ...DEFAULT_STATE, ...patch }, { now, listMembers }).map((p) => p.id);

describe('URL state', () => {
  it('round-trips through the query string and omits defaults', () => {
    const s: TableState = { ...DEFAULT_STATE, view: 'due', q: 'two', platforms: ['LEETCODE', 'GFG'], topics: ['Hash Map'], due: 'week', sort: 'difficulty', order: 'desc', group: 'topic' };
    const qs = serializeTableState(s);
    expect(parseTableState(new URLSearchParams(qs))).toEqual(s);
    expect(serializeTableState(DEFAULT_STATE)).toBe('');
  });

  it('maps legacy tab values and drops junk', () => {
    expect(parseTableState(new URLSearchParams('tab=LEETCODE')).platforms).toEqual(['LEETCODE']);
    expect(parseTableState(new URLSearchParams('tab=status')).group).toBe('status');
    expect(parseTableState(new URLSearchParams('tab=bookmarked')).view).toBe('bookmarked');
    const s = parseTableState(new URLSearchParams('tab=nope&platform=foo,gfg&sort=evil&due=x'));
    expect(s.view).toBe('all');
    expect(s.platforms).toEqual(['GFG']);
    expect(s.sort).toBe('dateAdded');
    expect(s.due).toBe('');
  });
});

describe('filterProblems', () => {
  it('combines a platform filter with the Due view', () => {
    expect(run({ view: 'due' })).toEqual(['a', 'b']);
    expect(run({ view: 'due', platforms: ['LEETCODE'] })).toEqual(['a']);
  });

  it('handles overdue and due-this-week quick filters, never retired', () => {
    expect(run({ due: 'overdue' })).toEqual(['a']);
    expect(run({ due: 'week' })).toEqual(['a', 'b', 'c']);
    expect(isOverdue(problems[3], now)).toBe(false);
    expect(isDueThisWeek(problems[4], now)).toBe(false);
  });

  it('filters by topic or tag, case-insensitively', () => {
    expect(run({ topics: ['hash map'] })).toEqual(['a', 'c']);
    expect(run({ topics: ['Math', 'Stack'] })).toEqual(['b', 'e']);
  });

  it('filters by list view and list filter', () => {
    const members = new Map([['l1', new Set(['a', 'c'])], ['l2', new Set(['e'])]]);
    expect(run({ view: 'list:l1' }, members)).toEqual(['a', 'c']);
    expect(run({ lists: ['l1', 'l2'] }, members)).toEqual(['a', 'c', 'e']);
    expect(run({ view: 'list:missing' }, members)).toEqual([]);
  });

  it('bookmarked view, difficulty and status filters', () => {
    expect(run({ view: 'bookmarked' })).toEqual(['a']);
    expect(run({ difficulties: ['MEDIUM'], statuses: ['MASTERED'] })).toEqual(['e']);
  });
});

describe('matchesSearch', () => {
  it('matches title, number, code, topic, tags and notes', () => {
    expect(matchesSearch(problems[0], 'two')).toBe(true);
    expect(matchesSearch(problems[2], '146')).toBe(true);
    expect(matchesSearch(problems[1], '4a')).toBe(true);
    expect(matchesSearch(problems[1], 'math')).toBe(true);
    expect(matchesSearch(problems[2], 'linked')).toBe(true);
    expect(matchesSearch(problems[0], 'a map')).toBe(true);
    expect(matchesSearch(problems[1], '0')).toBe(false); // problemNumber 0 is not searchable
  });
});

describe('helpers', () => {
  it('topicOptions dedupes topics and tags', () => {
    const opts = topicOptions(problems);
    expect(opts.find((o) => o.value.toLowerCase() === 'hash map')?.count).toBe(2);
    expect(opts.map((o) => o.value)).toContain('Linked List');
  });

  it('active filter detection and clearing keep the view', () => {
    const s = { ...DEFAULT_STATE, view: 'due', q: 'x', due: 'week' as const };
    expect(hasActiveFilters(s)).toBe(true);
    const cleared = clearFilters(s);
    expect(hasActiveFilters(cleared)).toBe(false);
    expect(cleared.view).toBe('due');
  });

  it('sorts by next revision and difficulty', () => {
    expect(sortProblems(problems, 'nextRevision').map((p) => p.id)).toEqual(['d', 'a', 'b', 'c', 'e']);
    expect(sortProblems(problems, 'difficulty', 'desc')[0].id).toBe('d');
  });

  it('finds the next review after today', () => {
    expect(nextReviewAfterToday(problems, now)?.toISOString()).toBe(day(5));
    expect(nextReviewAfterToday([], now)).toBeNull();
    expect(formatNextReview(new Date(day(1)), now)).toMatch(/^tomorrow/);
    expect(formatNextReview(new Date(day(5)), now)).toMatch(/^in 5 days/);
  });

  it('visibleLimitFor expands to include a highlighted row', () => {
    const ids = Array.from({ length: 300 }, (_, i) => `p${i}`);
    expect(visibleLimitFor(ids, 100, null)).toBe(100);
    expect(visibleLimitFor(ids, 100, 'p250')).toBe(251);
    expect(visibleLimitFor(ids, 100, 'p5')).toBe(100);
  });
});
