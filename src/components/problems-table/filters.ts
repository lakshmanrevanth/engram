// Pure table state + filtering helpers for the dashboard. No React here, so it can be unit tested.

export type SortOrder = 'asc' | 'desc';
export type DueFilter = '' | 'overdue' | 'week';
export type GroupBy = 'none' | 'status' | 'topic';

/** 'all' | 'due' | 'bookmarked' | `list:<id>` */
export type ViewKey = string;

export const PLATFORM_KEYS = ['LEETCODE', 'CODEFORCES', 'CODECHEF', 'GFG', 'HACKERRANK', 'SYSTEM_DESIGN'] as const;
export const DIFFICULTY_KEYS = ['EASY', 'MEDIUM', 'HARD'] as const;
export const STATUS_KEYS = ['ACTIVE', 'MASTERED', 'RETIRED'] as const;
export const SORT_KEYS = ['dateAdded', 'nextRevision', 'problemNumber', 'difficulty', 'status', 'topic'] as const;

export type TableState = {
  view: ViewKey;
  q: string;
  platforms: string[];
  difficulties: string[];
  statuses: string[];
  topics: string[];
  lists: string[];
  due: DueFilter;
  sort: string;
  order: SortOrder;
  group: GroupBy;
};

export const DEFAULT_STATE: TableState = {
  view: 'all',
  q: '',
  platforms: [],
  difficulties: [],
  statuses: [],
  topics: [],
  lists: [],
  due: '',
  sort: 'dateAdded',
  order: 'asc',
  group: 'none',
};

type ParamsLike = { get(name: string): string | null };

const splitList = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const pick = (values: string[], allowed: readonly string[]) => values.map((v) => v.toUpperCase()).filter((v) => allowed.includes(v));

/** Reads table state from URL params. Also accepts the old `?tab=LEETCODE|status|topic` links. */
export function parseTableState(params: ParamsLike): TableState {
  const s: TableState = { ...DEFAULT_STATE };
  const tab = params.get('tab') ?? '';
  if (tab === 'due' || tab === 'bookmarked') s.view = tab;
  else if (tab.startsWith('list:') && tab.length > 5) s.view = tab;
  else if ((PLATFORM_KEYS as readonly string[]).includes(tab)) s.platforms = [tab];
  else if (tab === 'status' || tab === 'topic') s.group = tab;

  s.q = params.get('q') ?? '';
  const platforms = pick(splitList(params.get('platform')), PLATFORM_KEYS);
  if (platforms.length) s.platforms = platforms;
  s.difficulties = pick(splitList(params.get('difficulty')), DIFFICULTY_KEYS);
  s.statuses = pick(splitList(params.get('status')), STATUS_KEYS);
  s.topics = splitList(params.get('topic'));
  s.lists = splitList(params.get('list'));
  const due = params.get('due');
  if (due === 'overdue' || due === 'week') s.due = due;
  const sort = params.get('sort');
  if (sort && (SORT_KEYS as readonly string[]).includes(sort)) s.sort = sort;
  const order = params.get('order');
  if (order === 'asc' || order === 'desc') s.order = order;
  const group = params.get('group');
  if (group === 'status' || group === 'topic') s.group = group;
  return s;
}

/** Serializes state to a query string, leaving out defaults. */
export function serializeTableState(s: TableState): string {
  const p = new URLSearchParams();
  if (s.view !== 'all') p.set('tab', s.view);
  if (s.q.trim()) p.set('q', s.q.trim());
  if (s.platforms.length) p.set('platform', s.platforms.join(','));
  if (s.difficulties.length) p.set('difficulty', s.difficulties.join(','));
  if (s.statuses.length) p.set('status', s.statuses.join(','));
  if (s.topics.length) p.set('topic', s.topics.join(','));
  if (s.lists.length) p.set('list', s.lists.join(','));
  if (s.due) p.set('due', s.due);
  if (s.sort !== DEFAULT_STATE.sort) p.set('sort', s.sort);
  if (s.order !== DEFAULT_STATE.order) p.set('order', s.order);
  if (s.group !== 'none') p.set('group', s.group);
  return p.toString();
}

export function hasSortParams(params: ParamsLike): boolean {
  return params.get('sort') !== null || params.get('order') !== null;
}

/** True when search or any filter (not the view) narrows the rows. */
export function hasActiveFilters(s: TableState): boolean {
  return !!(s.q.trim() || s.platforms.length || s.difficulties.length || s.statuses.length || s.topics.length || s.lists.length || s.due);
}

export function clearFilters(s: TableState): TableState {
  return { ...s, q: '', platforms: [], difficulties: [], statuses: [], topics: [], lists: [], due: '' };
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d: Date, plusDays = 0): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + plusDays, 23, 59, 59, 999);
}

type ProblemLike = {
  id: string;
  title?: string | null;
  problemNumber?: number | null;
  code?: string | null;
  topic?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  platform?: string | null;
  difficulty?: string | null;
  status?: string | null;
  isFavorite?: boolean | null;
  nextRevisionAt?: string | Date | null;
  dateSolved?: string | Date | null;
  createdAt?: string | Date | null;
};

const revTime = (p: ProblemLike) => (p.nextRevisionAt ? new Date(p.nextRevisionAt).getTime() : NaN);

/** Due by end of today (includes overdue). Retired problems are never due. */
export function isDueToday(p: ProblemLike, now: Date): boolean {
  const t = revTime(p);
  return p.status !== 'RETIRED' && !Number.isNaN(t) && t <= endOfDay(now).getTime();
}

export function isOverdue(p: ProblemLike, now: Date): boolean {
  const t = revTime(p);
  return p.status !== 'RETIRED' && !Number.isNaN(t) && t < startOfDay(now).getTime();
}

/** Due within the next 7 days (today + 6), including overdue. */
export function isDueThisWeek(p: ProblemLike, now: Date): boolean {
  const t = revTime(p);
  return p.status !== 'RETIRED' && !Number.isNaN(t) && t <= endOfDay(now, 6).getTime();
}

export function matchesSearch(p: ProblemLike, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    p.title,
    p.problemNumber != null && p.problemNumber > 0 ? String(p.problemNumber) : '',
    p.code,
    p.topic,
    ...(p.tags ?? []),
    p.notes,
  ];
  return hay.some((v) => (v ?? '').toLowerCase().includes(q));
}

/** Topic + tags of a problem, case-preserving, deduped case-insensitively. */
export function problemTopics(p: ProblemLike): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [p.topic ?? '', ...(p.tags ?? [])]) {
    const v = t.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

/** Sorted unique topic/tag options across all problems, with counts. */
export function topicOptions(problems: ProblemLike[]): { value: string; count: number }[] {
  const map = new Map<string, { value: string; count: number }>();
  for (const p of problems) {
    for (const t of problemTopics(p)) {
      const key = t.toLowerCase();
      const cur = map.get(key);
      if (cur) cur.count++;
      else map.set(key, { value: t, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => a.value.localeCompare(b.value));
}

export type FilterContext = {
  now: Date;
  /** listId -> problem ids in that list */
  listMembers?: Map<string, Set<string>>;
};

export function filterProblems<T extends ProblemLike>(problems: T[], s: TableState, ctx: FilterContext): T[] {
  const topicSet = new Set(s.topics.map((t) => t.toLowerCase()));
  const listId = s.view.startsWith('list:') ? s.view.slice(5) : null;
  const viewMembers = listId ? ctx.listMembers?.get(listId) ?? new Set<string>() : null;
  const filterMembers = s.lists.map((id) => ctx.listMembers?.get(id) ?? new Set<string>());

  return problems.filter((p) => {
    if (s.view === 'due' && !isDueToday(p, ctx.now)) return false;
    if (s.view === 'bookmarked' && !p.isFavorite) return false;
    if (viewMembers && !viewMembers.has(p.id)) return false;

    if (!matchesSearch(p, s.q)) return false;
    if (s.platforms.length && !s.platforms.includes(p.platform ?? '')) return false;
    if (s.difficulties.length && !s.difficulties.includes(p.difficulty ?? '')) return false;
    if (s.statuses.length && !s.statuses.includes(p.status ?? '')) return false;
    if (topicSet.size && !problemTopics(p).some((t) => topicSet.has(t.toLowerCase()))) return false;
    if (filterMembers.length && !filterMembers.some((m) => m.has(p.id))) return false;
    if (s.due === 'overdue' && !isOverdue(p, ctx.now)) return false;
    if (s.due === 'week' && !isDueThisWeek(p, ctx.now)) return false;
    return true;
  });
}

export function sortProblems<T extends ProblemLike>(problems: T[], sort: string, order: SortOrder = 'asc'): T[] {
  const mult = order === 'asc' ? 1 : -1;
  const rank = (map: Record<string, number>, v?: string | null) => map[v ?? ''] ?? 0;
  return [...problems].sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case 'dateAdded':
        cmp = new Date(a.dateSolved || a.createdAt || 0).getTime() - new Date(b.dateSolved || b.createdAt || 0).getTime();
        break;
      case 'problemNumber': {
        const va = typeof a.problemNumber === 'number' && a.problemNumber > 0 ? a.problemNumber : (a.code || a.title || '');
        const vb = typeof b.problemNumber === 'number' && b.problemNumber > 0 ? b.problemNumber : (b.code || b.title || '');
        cmp = typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), undefined, { numeric: true });
        break;
      }
      case 'difficulty':
        cmp = rank({ EASY: 1, MEDIUM: 2, HARD: 3 }, a.difficulty) - rank({ EASY: 1, MEDIUM: 2, HARD: 3 }, b.difficulty);
        break;
      case 'status':
        cmp = rank({ ACTIVE: 1, MASTERED: 2, RETIRED: 3 }, a.status) - rank({ ACTIVE: 1, MASTERED: 2, RETIRED: 3 }, b.status);
        break;
      case 'topic':
        cmp = (a.topic || '').toLowerCase().localeCompare((b.topic || '').toLowerCase());
        break;
      case 'nextRevision':
      default: {
        const ta = a.nextRevisionAt ? new Date(a.nextRevisionAt).getTime() : Infinity;
        const tb = b.nextRevisionAt ? new Date(b.nextRevisionAt).getTime() : Infinity;
        cmp = ta === tb ? 0 : ta - tb;
        break;
      }
    }
    return cmp * mult;
  });
}

/** Earliest upcoming review (after today) among non-retired problems. */
export function nextReviewAfterToday(problems: ProblemLike[], now: Date): Date | null {
  const limit = endOfDay(now).getTime();
  let best = Infinity;
  for (const p of problems) {
    const t = revTime(p);
    if (p.status !== 'RETIRED' && !Number.isNaN(t) && t > limit && t < best) best = t;
  }
  return best === Infinity ? null : new Date(best);
}

/** "tomorrow", "in 3 days (Fri, Nov 7)" */
export function formatNextReview(date: Date, now: Date): string {
  const days = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (days <= 0) return 'today';
  if (days === 1) return `tomorrow (${label})`;
  return `in ${days} days (${label})`;
}

/** Items to render: first `limit`, but always including `mustShowId` if present. */
export function visibleLimitFor(ids: string[], limit: number, mustShowId: string | null): number {
  if (!mustShowId) return limit;
  const idx = ids.indexOf(mustShowId);
  return idx >= limit ? idx + 1 : limit;
}
