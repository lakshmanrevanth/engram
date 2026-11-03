// Custom column types and value helpers (shared by API routes, table cells and import/export).
// Values live in Problem.customFields keyed by column NAME and are always stored as strings:
//   text → free text, select → one of the options, date → "YYYY-MM-DD",
//   checkbox → "true" or "" (unchecked), url → absolute http(s) URL.

export const COLUMN_TYPES = ['text', 'select', 'date', 'checkbox', 'url'] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  text: 'Text',
  select: 'Select',
  date: 'Date',
  checkbox: 'Checkbox',
  url: 'Link',
};

export const MAX_COLUMN_NAME_LENGTH = 40;
export const MAX_SELECT_OPTIONS = 50;
export const MAX_OPTION_LENGTH = 40;
export const MAX_VALUE_LENGTH = 1000;
export const MAX_COLUMNS = 30;

export type CustomColumn = {
  id: string;
  name: string;
  type: ColumnType;
  options: string[];
  order: number;
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function isColumnType(v: unknown): v is ColumnType {
  return typeof v === 'string' && (COLUMN_TYPES as readonly string[]).includes(v);
}

/** Coerce a DB row (type String, options Json?) into a typed column. */
export function toCustomColumn(row: { id: string; name: string; type?: string | null; options?: unknown; order: number }): CustomColumn {
  const type = isColumnType(row.type) ? row.type : 'text';
  const opts = normalizeOptions(row.options);
  return { id: row.id, name: row.name, type, options: opts.ok ? opts.value : [], order: row.order };
}

/** Trim + collapse whitespace; checks length and case-insensitive uniqueness against `existing`. */
export function validateColumnName(
  raw: unknown,
  existing: { id: string; name: string }[] = [],
  selfId?: string
): Result<string> {
  if (typeof raw !== 'string') return { ok: false, error: 'Column name is required' };
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'Column name is required' };
  if (name.length > MAX_COLUMN_NAME_LENGTH) {
    return { ok: false, error: `Column name must be ${MAX_COLUMN_NAME_LENGTH} characters or fewer` };
  }
  const lower = name.toLowerCase();
  if (existing.some((c) => c.id !== selfId && c.name.trim().toLowerCase() === lower)) {
    return { ok: false, error: `A column named "${name}" already exists` };
  }
  return { ok: true, value: name };
}

/** Accepts an array or comma/newline separated string; trims, drops blanks and case-insensitive dupes. */
export function normalizeOptions(raw: unknown): Result<string[]> {
  if (raw === null || raw === undefined) return { ok: true, value: [] };
  let list: unknown[];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'string') list = raw.split(/[\n,]/);
  else return { ok: false, error: 'Options must be a list of text values' };

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (typeof item !== 'string' && typeof item !== 'number') continue;
    const opt = String(item).trim();
    if (!opt) continue;
    if (opt.length > MAX_OPTION_LENGTH) {
      return { ok: false, error: `Options must be ${MAX_OPTION_LENGTH} characters or fewer` };
    }
    const key = opt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(opt);
  }
  if (out.length > MAX_SELECT_OPTIONS) {
    return { ok: false, error: `A select column can have at most ${MAX_SELECT_OPTIONS} options` };
  }
  return { ok: true, value: out };
}

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'x', '✓', '✔', 'checked', 'done', 'on']);
const FALSE_WORDS = new Set(['', 'false', 'no', 'n', '0', 'unchecked', 'off']);

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Parse a user-entered date into "YYYY-MM-DD" (calendar date, no timezone shift). */
export function parseDateValue(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T)/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isRealDate(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    let [a, b] = [Number(m[1]), Number(m[2])];
    const y = Number(m[3]);
    // Ambiguous dd/mm vs mm/dd: day > 12 decides, otherwise assume mm/dd.
    if (a > 12 && b <= 12) [a, b] = [b, a];
    return isRealDate(y, a, b) ? `${y}-${pad(a)}-${pad(b)}` : null;
  }
  const t = Date.parse(s);
  if (!isNaN(t) && /[a-z]/i.test(s)) {
    const d = new Date(t);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return null;
}

function isRealDate(y: number, m: number, d: number) {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Returns a normalized absolute http(s) URL, or null. */
export function parseUrlValue(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^[a-z][a-z\d+.-]*:/i.test(s)) {
    if (!/^[\w-]+(\.[\w-]+)+/.test(s)) return null;
    s = `https://${s}`;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Validate and normalize a value for a column type. Empty input is always valid ("" = cleared).
 * Returns the string to store in customFields.
 */
export function parseCustomValue(
  column: Pick<CustomColumn, 'type' | 'options'>,
  raw: unknown
): Result<string> {
  if (raw === null || raw === undefined) return { ok: true, value: '' };
  if (typeof raw === 'boolean' && column.type === 'checkbox') return { ok: true, value: raw ? 'true' : '' };
  if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') {
    return { ok: false, error: 'Value must be text' };
  }
  const s = String(raw).trim();

  switch (column.type) {
    case 'checkbox': {
      const lower = s.toLowerCase();
      if (TRUE_WORDS.has(lower)) return { ok: true, value: 'true' };
      if (FALSE_WORDS.has(lower)) return { ok: true, value: '' };
      return { ok: false, error: 'Use yes/no or true/false' };
    }
    case 'select': {
      if (!s) return { ok: true, value: '' };
      const match = column.options.find((o) => o.toLowerCase() === s.toLowerCase());
      return match ? { ok: true, value: match } : { ok: false, error: `"${s}" is not one of the options` };
    }
    case 'date': {
      if (!s) return { ok: true, value: '' };
      const d = parseDateValue(s);
      return d ? { ok: true, value: d } : { ok: false, error: 'Use a date like 2025-01-31' };
    }
    case 'url': {
      if (!s) return { ok: true, value: '' };
      const u = parseUrlValue(s);
      return u ? { ok: true, value: u } : { ok: false, error: 'Enter a valid http(s) link' };
    }
    default: {
      if (s.length > MAX_VALUE_LENGTH) {
        return { ok: false, error: `Text must be ${MAX_VALUE_LENGTH} characters or fewer` };
      }
      return { ok: true, value: s };
    }
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Human-readable display text for a stored value. Unparseable values are shown as-is. */
export function formatCustomValue(column: Pick<CustomColumn, 'type'>, stored: unknown): string {
  if (stored === null || stored === undefined) return '';
  const s = String(stored);
  if (!s) return '';
  switch (column.type) {
    case 'checkbox':
      return isChecked(s) ? 'Yes' : '';
    case 'date': {
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : s;
    }
    case 'url': {
      try {
        const u = new URL(s);
        return (u.host + u.pathname).replace(/\/$/, '');
      } catch {
        return s;
      }
    }
    default:
      return s;
  }
}

export function isChecked(stored: unknown): boolean {
  return typeof stored === 'boolean' ? stored : TRUE_WORDS.has(String(stored ?? '').trim().toLowerCase());
}

/** Safely read customFields JSON as a string map. */
export function readCustomFields(json: unknown): Record<string, string> {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

/** Returns a new map with `from` renamed to `to`, or null when nothing changes. */
export function renameFieldKey(fields: Record<string, string>, from: string, to: string): Record<string, string> | null {
  if (from === to || !(from in fields)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === from) out[to] = v;
    else if (k !== to) out[k] = v;
  }
  return out;
}

/** Returns a new map without `key`, or null when it wasn't there. */
export function removeFieldKey(fields: Record<string, string>, key: string): Record<string, string> | null {
  if (!(key in fields)) return null;
  const { [key]: _removed, ...rest } = fields;
  return rest;
}

/** Distinct non-empty values (first spelling wins), capped — used to seed select options. */
export function distinctValues(values: Iterable<string>, cap = MAX_SELECT_OPTIONS): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = v.trim();
    if (!s || s.length > MAX_OPTION_LENGTH || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

/** Move the item with `id` to `toIndex`; returns ids in new order. */
export function reorderIds(ids: string[], id: string, toIndex: number): string[] {
  const from = ids.indexOf(id);
  if (from === -1) return ids;
  const next = ids.filter((x) => x !== id);
  const clamped = Math.max(0, Math.min(next.length, Math.trunc(toIndex)));
  next.splice(clamped, 0, id);
  return next;
}
