// Pure validation / normalisation helpers shared by the problem API routes and the
// add/edit UI. No server-only imports here, so client components can use them too.

import { getInitialSchedule } from '@/lib/scheduling';

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;
export const MAX_TITLE_LENGTH = 300;
export const MAX_CODE_LENGTH = 40;

// Allow a little slack for timezones ahead of the server's clock.
const FUTURE_SLACK_MS = 14 * 60 * 60 * 1000;

export function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Trims, drops empties and case-insensitive duplicates. Returns an error for bad input.
export function normalizeTags(input: unknown): { tags: string[] } | { error: string } {
  if (!Array.isArray(input)) return { error: 'tags must be an array of strings' };
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') return { error: 'tags must be an array of strings' };
    const t = raw.trim().replace(/\s+/g, ' ');
    if (!t) continue;
    if (t.length > MAX_TAG_LENGTH) return { error: `Each tag must be at most ${MAX_TAG_LENGTH} characters` };
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(t);
  }
  if (tags.length > MAX_TAGS) return { error: `At most ${MAX_TAGS} tags per problem` };
  return { tags };
}

// Parses a solve date. Rejects invalid and future dates.
export function parseSolvedDate(input: unknown, now: Date = new Date()): { date: Date } | { error: string } {
  if (typeof input !== 'string' && typeof input !== 'number' && !(input instanceof Date)) {
    return { error: 'dateSolved must be a date' };
  }
  const date = new Date(input);
  if (isNaN(date.getTime())) return { error: 'dateSolved is not a valid date' };
  if (date.getTime() > now.getTime() + FUTURE_SLACK_MS) {
    return { error: "Solve date can't be in the future" };
  }
  if (date.getFullYear() < 2000) return { error: 'dateSolved is too far in the past' };
  return { date };
}

// First review = solve date + first ladder step, but never earlier than now
// (an old solve date makes the problem due today, not "overdue by weeks").
export function initialScheduleFor(solvedAt: Date, ladder: readonly number[] | undefined, now: Date = new Date()) {
  const schedule = getInitialSchedule(solvedAt, ladder);
  if (schedule.nextRevisionAt.getTime() < now.getTime()) {
    return { ...schedule, nextRevisionAt: new Date(now) };
  }
  return schedule;
}

// Stable positive number for problems without a natural number (keeps the
// (userId, platform, problemNumber) unique key from colliding on 0).
export function hashToProblemNumber(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return 100000 + (Math.abs(hash) % 899999);
}

// "1234A" → 123401 (same scheme as data/codeforces-problems.json). Split problems
// get a distinct number ("1234C2" → 1234032) so C1 and C2 don't collide.
export function codeforcesNumericId(code: string): number | null {
  const m = code.trim().toUpperCase().match(/^(\d+)([A-Z])(\d?)$/);
  if (!m) return null;
  const base = parseInt(m[1], 10) * 100 + (m[2].charCodeAt(0) - 64);
  return m[3] ? base * 10 + parseInt(m[3], 10) : base;
}

export function normalizeCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const c = input.trim();
  if (!c || c.length > MAX_CODE_LENGTH || /^https?:/i.test(c) || /\s/.test(c)) return null;
  return c.toUpperCase();
}

// Code shown in the number cell: stored code, else derived from the URL.
export function displayCode(problem: { platform: string; code?: string | null; url?: string | null; problemNumber?: number }): string | null {
  if (problem.code) return problem.code;
  const url = problem.url ?? '';
  if (problem.platform === 'CODEFORCES') {
    const m = url.match(/(?:problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([A-Za-z]\d*)/);
    if (m) return `${m[1]}${m[2].toUpperCase()}`;
  }
  if (problem.platform === 'CODECHEF') {
    const m = url.match(/codechef\.com\/(?:[^/]+\/)?problems\/([A-Za-z0-9_]+)/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

// "YYYY-MM-DD" for a Date in the browser's local time.
export function toLocalDateInput(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Local date input → ISO. Today keeps the current time (schedule from "now");
// earlier days use local noon so timezones don't shift the day.
export function localDateInputToISO(value: string, now: Date = new Date()): string {
  if (!value || value === toLocalDateInput(now)) return now.toISOString();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0).toISOString();
}
