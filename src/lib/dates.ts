// Timezone-aware "day" helpers.
//
// The server runs in UTC, but a user's "today" is their local calendar day.
// The browser stores its IANA timezone in the `tz` cookie (see TimezoneCookie),
// and every API that groups by day (streak, heatmap, completed-today, undo)
// uses these helpers so they all agree on where a day starts and ends.

export const TZ_COOKIE = 'tz';

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Reads the user's timezone from the request cookie, falling back to UTC. */
export function getRequestTimeZone(req: { cookies: { get(name: string): { value: string } | undefined } }): string {
  const raw = req.cookies.get(TZ_COOKIE)?.value;
  let tz: string | null = null;
  try {
    tz = raw ? decodeURIComponent(raw) : null;
  } catch {
    // Malformed percent-encoding (e.g. "%E0") would otherwise throw and 500 every day-based route.
  }
  return isValidTimeZone(tz) ? tz : 'UTC';
}

function parts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** "YYYY-MM-DD" for the calendar day `date` falls on in `tz`. */
export function dateKeyInTz(date: Date, tz: string): string {
  const p = parts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Offset of `tz` from UTC at `date`, in minutes (e.g. +330 for Asia/Kolkata). */
function tzOffsetMinutes(date: Date, tz: string): number {
  const p = parts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** UTC instants for the start and end of the local day containing `date` in `tz`. */
export function dayRangeInTz(date: Date, tz: string): { start: Date; end: Date } {
  const [y, m, d] = dateKeyInTz(date, tz).split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const start = new Date(guess - tzOffsetMinutes(new Date(guess), tz) * 60000);
  const nextGuess = Date.UTC(y, m - 1, d + 1);
  const nextStart = new Date(nextGuess - tzOffsetMinutes(new Date(nextGuess), tz) * 60000);
  return { start, end: new Date(nextStart.getTime() - 1) };
}

/** Value to store in StreakLog.date (a @db.Date column) for the user's local day. */
export function streakDateFor(date: Date, tz: string): Date {
  const [y, m, d] = dateKeyInTz(date, tz).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** Shift a "YYYY-MM-DD" key by whole days. */
export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** UTC instant when the calendar day "YYYY-MM-DD" starts in `tz`. */
export function startOfDayKeyInTz(key: string, tz: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  return new Date(guess - tzOffsetMinutes(new Date(guess), tz) * 60000);
}
