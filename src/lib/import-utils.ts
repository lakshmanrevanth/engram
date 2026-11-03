import { getResolver } from './platforms';
import { addDays, getInitialSchedule, MASTERY_RECHECK_DAYS, normalizeLadder } from './scheduling';
import { isColumnType, normalizeOptions, readCustomFields, type ColumnType } from './custom-columns';
import { siteConfig } from '@/config/site';

export type RecallField =
  | 'title'
  | 'problemNumber'
  | 'platform'
  | 'difficulty'
  | 'topic'
  | 'url'
  | 'dateSolved'
  | 'notes'
  | 'code'
  | 'tags'
  | 'lists'
  | 'isFavorite'
  | 'status'
  | 'currentStep'
  | 'nextRevisionAt'
  | 'revisionCount'
  | 'skip'
  | `custom:${string}`;

// Limits shared by the modal and the import route.
export const MAX_IMPORT_ROWS = 2000;
export const MAX_SPREADSHEET_BYTES = 5 * 1024 * 1024;
export const MAX_BACKUP_BYTES = 15 * 1024 * 1024;
export const MAX_REVISIONS_PER_PROBLEM = 500;

// Header names written by GET /api/export?format=csv, in order (custom columns follow).
export const EXPORT_CSV_HEADERS: { header: string; field: RecallField }[] = [
  { header: 'Title', field: 'title' },
  { header: 'Platform', field: 'platform' },
  { header: 'Number', field: 'problemNumber' },
  { header: 'Code', field: 'code' },
  { header: 'Difficulty', field: 'difficulty' },
  { header: 'Topic', field: 'topic' },
  { header: 'Tags', field: 'tags' },
  { header: 'URL', field: 'url' },
  { header: 'Date Solved', field: 'dateSolved' },
  { header: 'Notes', field: 'notes' },
  { header: 'Status', field: 'status' },
  { header: 'Step', field: 'currentStep' },
  { header: 'Next Revision', field: 'nextRevisionAt' },
  { header: 'Revision Count', field: 'revisionCount' },
  { header: 'Favorite', field: 'isFavorite' },
  { header: 'Lists', field: 'lists' },
];

/** Fields that carry schedule state; when mapped, the "keep schedule" strategy becomes available. */
export const SCHEDULE_FIELDS: RecallField[] = ['status', 'currentStep', 'nextRevisionAt', 'revisionCount'];

export type Platform = 'LEETCODE' | 'CODEFORCES' | 'GFG' | 'HACKERRANK' | 'CODECHEF' | 'SYSTEM_DESIGN';

export type ParsedFile = {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
};

export type ColumnMapping = Record<string, RecallField>;

// preserve = keep status/step/next revision from the file (backups, or CSVs exported by Engram)
export type ImportStrategy = 'staggered' | 'fresh' | 'archive' | 'preserve';

// What to do when a problem (same platform + number) already exists.
export type DuplicateStrategy = 'skip' | 'overwrite' | 'merge';

export type ProblemStatusValue = 'ACTIVE' | 'MASTERED' | 'RETIRED';

export type ImportedRevision = {
  revisedAt: string; // ISO
  confidence: 'CLEAN' | 'SHAKY' | 'STRUGGLED';
  type: 'REGULAR' | 'RECHECK';
  stepBefore: number;
  stepAfter: number;
};

export type ProcessedProblem = {
  platform: Platform;
  problemNumber: number;
  title: string;
  url: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topic: string;
  dateSolved: string; // ISO string
  notes: string | null;
  customFields?: Record<string, string>;
  currentStep: number;
  nextRevisionAt: string; // ISO string
  status: ProblemStatusValue;
  code?: string | null;
  tags?: string[];
  lists?: string[];
  isFavorite?: boolean;
  revisionCount?: number;
  revisions?: ImportedRevision[];
  /** Schedule as found in the file, used by the "preserve" strategy. */
  original?: { status: ProblemStatusValue; currentStep: number; nextRevisionAt: string; revisionCount?: number };
  /** Fields filled with defaults (not in the file); overwrite/merge leave those alone. */
  defaulted?: string[];
};

export type ImportColumnDef = { name: string; type: ColumnType; options: string[] };

export type ValidationResult = {
  valid: ProcessedProblem[];
  warnings: { row: number; message: string }[];
  errors: { row: number; message: string }[];
  skipped: { row: number; reason: string }[];
  customColumns: string[];
  /** Typed definitions for columns (from a backup); plain names in customColumns default to text. */
  columnDefs?: ImportColumnDef[];
  streakLogs?: { date: string; completed: boolean }[];
};

export type ImportRequestBody = {
  problems: ProcessedProblem[];
  customColumns?: string[];
  columnDefs?: ImportColumnDef[];
  streakLogs?: { date: string; completed: boolean }[];
  duplicateStrategy?: DuplicateStrategy;
};

// -----------------------------------------------------------------------------
// File Parsing
// -----------------------------------------------------------------------------

export function detectFileType(file: File): 'csv' | 'excel' | 'json' | 'unsupported' {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();

  if (name.endsWith('.json') || type === 'application/json') {
    return 'json';
  }

  if (name.endsWith('.csv') || type === 'text/csv' || type === 'application/csv') {
    return 'csv';
  }

  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    type === 'application/vnd.ms-excel'
  ) {
    return 'excel';
  }

  return 'unsupported';
}

export async function parseCsvFile(file: File): Promise<ParsedFile> {
  const Papa = (await import('papaparse')).default;

  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header: string) => header.trim(),
      complete: (results) => {
        const headers = (results.meta.fields || [])
          .map((h) => h.trim())
          .filter(Boolean);

        const rows: Record<string, string>[] = [];

        for (const rawRow of results.data as Record<string, any>[]) {
          const row: Record<string, string> = {};
          let hasAnyContent = false;

          for (const key of Object.keys(rawRow)) {
            const trimmedKey = key.trim();
            if (!trimmedKey) continue;
            const val = rawRow[key];
            const strVal = val !== null && val !== undefined ? String(val).trim() : '';
            if (strVal) hasAnyContent = true;
            row[trimmedKey] = strVal;
          }

          if (hasAnyContent) {
            rows.push(row);
          }
        }

        resolve({
          headers,
          rows,
          totalRows: rows.length,
        });
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

export async function parseExcelFile(file: File): Promise<ParsedFile> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    raw: false,
    defval: '',
  });

  if (jsonData.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const headers = Object.keys(jsonData[0])
    .map((h) => h.trim())
    .filter(Boolean);

  const rows: Record<string, string>[] = [];

  for (const rawRow of jsonData) {
    const row: Record<string, string> = {};
    let hasAnyContent = false;

    for (const key of Object.keys(rawRow)) {
      const trimmedKey = key.trim();
      if (!trimmedKey) continue;
      const val = rawRow[key];
      const strVal = val !== null && val !== undefined ? String(val).trim() : '';
      if (strVal) hasAnyContent = true;
      row[trimmedKey] = strVal;
    }

    if (hasAnyContent) {
      rows.push(row);
    }
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}

// -----------------------------------------------------------------------------
// Auto Detection & Column Mapping
// -----------------------------------------------------------------------------

export function autoDetectMappings(
  headers: string[],
  existingCustomColumns: string[] = []
): Record<string, RecallField> {
  const mapping: Record<string, RecallField> = {};
  const assigned = new Set<RecallField>();

  // Exact matches for Engram's own export headers win first, so exports round-trip.
  const exact = new Map(EXPORT_CSV_HEADERS.map((e) => [e.header.toLowerCase(), e.field]));
  const customLower = new Set(existingCustomColumns.map((c) => c.toLowerCase().trim()));
  for (const header of headers) {
    const h = header.toLowerCase().trim();
    const field = exact.get(h);
    if (field && !assigned.has(field) && !customLower.has(h)) {
      mapping[header] = field;
      assigned.add(field);
    }
  }

  for (const header of headers) {
    if (mapping[header]) continue;
    const h = header.toLowerCase().trim();

    const checkField = (field: RecallField, condition: boolean): boolean => {
      if (condition && !assigned.has(field)) {
        mapping[header] = field;
        assigned.add(field);
        return true;
      }
      return false;
    };

    // 1. Problem Number (check before title so "problem number" or "problem #" isn't caught by title)
    if (
      checkField(
        'problemNumber',
        /\b(number|no|#|id|s\.no|sno|sr|code)\b/i.test(h) ||
          h === '#' ||
          h === 'no' ||
          h === 'id' ||
          h.includes('problem number') ||
          h.includes('problem #') ||
          h.includes('question number')
      )
    ) {
      continue;
    }

    // 2. Title / Question
    if (
      checkField(
        'title',
        /\b(title|question|problem|name)\b/i.test(h) ||
          h === 'title' ||
          h === 'name' ||
          h === 'question' ||
          h.includes('problem name') ||
          h.includes('question name')
      )
    ) {
      continue;
    }

    // 3. Platform
    if (
      checkField(
        'platform',
        /\b(platform|source|site|judge)\b/i.test(h) || h === 'platform' || h === 'source'
      )
    ) {
      continue;
    }

    // 4. Difficulty
    if (
      checkField(
        'difficulty',
        /\b(difficulty|diff|level)\b/i.test(h) || h === 'difficulty' || h === 'diff'
      )
    ) {
      continue;
    }

    // 5. Topic / Tags
    if (
      checkField(
        'topic',
        /\b(topic|tag|tags|category|type|subject)\b/i.test(h) || h === 'topic' || h === 'tags'
      )
    ) {
      continue;
    }

    // 6. URL / Link
    if (
      checkField(
        'url',
        /\b(url|link|href|webpage)\b/i.test(h) || h === 'url' || h === 'link'
      )
    ) {
      continue;
    }

    // 7. Date Solved
    if (
      checkField(
        'dateSolved',
        /\b(date|solved|completed|when)\b/i.test(h) || h === 'date' || h.includes('date solved')
      )
    ) {
      continue;
    }

    // 8. Notes
    if (
      checkField(
        'notes',
        /\b(note|notes|comment|comments|remark|remarks)\b/i.test(h) || h === 'notes' || h === 'note'
      )
    ) {
      continue;
    }

    // 9. Match existing user custom columns if provided
    let matchedCustom = false;
    for (const ec of existingCustomColumns) {
      if (ec.toLowerCase().trim() === h) {
        mapping[header] = `custom:${ec}` as RecallField;
        matchedCustom = true;
        break;
      }
    }
    if (matchedCustom) continue;

    // 10. Directly map any other non-standard column as a custom column
    const cleanHeader = header.trim();
    if (cleanHeader) {
      mapping[header] = `custom:${cleanHeader}` as RecallField;
    } else {
      mapping[header] = 'skip';
    }
  }

  return mapping;
}

// -----------------------------------------------------------------------------
// Normalization Utilities
// -----------------------------------------------------------------------------

export function normalizeDifficulty(value?: string | null): 'EASY' | 'MEDIUM' | 'HARD' {
  if (!value) return 'MEDIUM';
  const v = value.trim().toLowerCase();

  if (
    v === 'easy' ||
    v === 'e' ||
    v === '1' ||
    v === 'simple' ||
    v === 'basic' ||
    v.startsWith('easy')
  ) {
    return 'EASY';
  }

  if (
    v === 'hard' ||
    v === 'h' ||
    v === '3' ||
    v === 'difficult' ||
    v === 'advanced' ||
    v === 'expert' ||
    v.startsWith('hard')
  ) {
    return 'HARD';
  }

  if (
    v === 'medium' ||
    v === 'm' ||
    v === '2' ||
    v === 'med' ||
    v === 'moderate' ||
    v === 'intermediate' ||
    v.startsWith('med')
  ) {
    return 'MEDIUM';
  }

  return 'MEDIUM';
}

export function parseDate(value?: string | null): Date {
  return tryParseDate(value) ?? new Date();
}

/** Like parseDate, but returns null for empty or unrecognized input. */
export function tryParseDate(value?: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Numeric: timestamp or Excel serial date
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const num = parseFloat(trimmed);
    // Unix timestamp in ms
    if (num > 10000000000) {
      const d = new Date(num);
      if (!isNaN(d.getTime())) return d;
    }
    // Unix timestamp in seconds
    if (num > 1000000000) {
      const d = new Date(num * 1000);
      if (!isNaN(d.getTime())) return d;
    }
    // Excel serial date (e.g. 45678)
    if (num >= 20000 && num <= 70000) {
      const excelEpoch = new Date(1899, 11, 30);
      const msPerDay = 86400000;
      const d = new Date(excelEpoch.getTime() + num * msPerDay);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Try standard parse
  const parsedTime = Date.parse(trimmed);
  if (!isNaN(parsedTime)) {
    return new Date(parsedTime);
  }

  // Regex patterns: DD/MM/YYYY or DD-MM-YYYY
  const partsMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (partsMatch) {
    const p1 = parseInt(partsMatch[1], 10);
    const p2 = parseInt(partsMatch[2], 10);
    const year = parseInt(partsMatch[3], 10);

    // If p1 > 12, p1 is day, p2 is month
    if (p1 > 12 && p2 <= 12) {
      return new Date(year, p2 - 1, p1);
    }
    // If p2 > 12, p2 is day, p1 is month
    if (p2 > 12 && p1 <= 12) {
      return new Date(year, p1 - 1, p2);
    }
    // Default to US format (p1: month, p2: day)
    return new Date(year, p1 - 1, p2);
  }

  return null;
}

export function detectPlatformFromUrl(url?: string | null): Platform | null {
  if (!url) return null;
  const lower = url.toLowerCase();

  if (lower.includes('leetcode.com')) return 'LEETCODE';
  if (lower.includes('codeforces.com')) return 'CODEFORCES';
  if (lower.includes('geeksforgeeks.org') || lower.includes('gfg')) return 'GFG';
  if (lower.includes('hackerrank.com')) return 'HACKERRANK';
  if (lower.includes('codechef.com')) return 'CODECHEF';

  return null;
}

export function normalizePlatform(value?: string | null): Platform | null {
  if (!value) return null;
  const v = value.trim().toLowerCase().replace(/[\s_-]+/g, '');

  if (v === 'leetcode' || v === 'lc') return 'LEETCODE';
  if (v === 'codeforces' || v === 'cf') return 'CODEFORCES';
  if (v === 'gfg' || v === 'geeksforgeeks') return 'GFG';
  if (v === 'hackerrank' || v === 'hr') return 'HACKERRANK';
  if (v === 'codechef' || v === 'cc') return 'CODECHEF';
  if (v === 'systemdesign' || v === 'sd') return 'SYSTEM_DESIGN';

  return null;
}

export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function normalizeTopic(value?: string | null): string {
  if (!value) return 'General';
  const trimmed = value.trim();
  if (!trimmed) return 'General';

  // Capitalize words
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeUrl(value?: string | null): string {
  if (!value) return '#';
  const trimmed = value.trim();
  if (!trimmed) return '#';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.includes('.com') || trimmed.includes('.org') || trimmed.includes('.io') || trimmed.includes('.net')) {
    return `https://${trimmed}`;
  }

  return '#';
}

export function isRowEmpty(row: Record<string, string>, mappedFields?: string[]): boolean {
  if (mappedFields && mappedFields.length > 0) {
    return mappedFields.every((field) => !row[field] || !row[field].trim());
  }
  return Object.values(row).every((val) => !val || !val.trim());
}

export function computeStaggerSchedule(
  index: number,
  totalProblems: number,
  today: Date,
  batchSize: number = 10
): Date {
  const dayOffset = Math.floor(index / Math.max(1, batchSize));
  const target = new Date(today.getTime());
  target.setDate(target.getDate() + dayOffset);
  return target;
}

// -----------------------------------------------------------------------------
// Problem Number Extraction
// -----------------------------------------------------------------------------

export async function extractProblemNumberFromUrl(
  url: string,
  platform: Platform
): Promise<number | null> {
  if (!url || url === '#') return null;

  try {
    if (platform === 'LEETCODE') {
      const match = url.match(/leetcode\.com\/problems\/([^/?#]+)/i);
      if (match && match[1]) {
        const slug = match[1].toLowerCase();
        // Check local JSON dataset if available
        try {
          const leetcodeData = (await import('../data/leetcode-problems.json')).default as any[];
          const item = leetcodeData.find((p) => p.slug?.toLowerCase() === slug);
          if (item?.id) return item.id;
        } catch {}
        return hashString(slug);
      }
    }

    if (platform === 'CODEFORCES') {
      const match = url.match(/codeforces\.com\/(?:problemset\/problem|contest)\/(\d+)\/([A-Za-z\d]+)/i);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    if (platform === 'CODECHEF') {
      const match = url.match(/codechef\.com\/(?:[^\/]+\/)?problems\/([A-Za-z\d_]+)/i);
      if (match) {
        const code = match[1].toUpperCase();
        try {
          const ccData = (await import('../data/codechef-problems.json')).default as any[];
          const item = ccData.find((p) => p.code?.toUpperCase() === code);
          if (item?.numericId) return item.numericId;
        } catch {}
        return hashString(code);
      }
    }

    if (platform === 'GFG') {
      const match = url.match(/geeksforgeeks\.org\/problems\/([^/?#]+)/i);
      const slug = match ? match[1].toLowerCase() : url.split('/').filter(Boolean).pop()?.toLowerCase();
      if (slug) return hashString(slug);
    }

    if (platform === 'HACKERRANK') {
      const match = url.match(/hackerrank\.com\/(?:contests\/[^/]+\/)?challenges\/([^/?#]+)/i);
      const slug = match ? match[1].toLowerCase() : url.split('/').filter(Boolean).pop()?.toLowerCase();
      if (slug) return hashString(slug);
    }
  } catch {}

  return null;
}

// -----------------------------------------------------------------------------
// Value parsers for the extra (round-trip) fields
// -----------------------------------------------------------------------------

const VALID_PLATFORMS: Platform[] = ['LEETCODE', 'CODEFORCES', 'GFG', 'HACKERRANK', 'CODECHEF', 'SYSTEM_DESIGN'];
const VALID_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;

export function parseStatus(value?: string | null): ProblemStatusValue | null {
  const v = (value ?? '').trim().toUpperCase();
  return v === 'ACTIVE' || v === 'MASTERED' || v === 'RETIRED' ? v : null;
}

export function parseBoolean(value?: string | null): boolean {
  return ['true', 'yes', 'y', '1', 'x', '★', '✓', 'favorite'].includes((value ?? '').trim().toLowerCase());
}

/** Splits "a; b | c" (and commas when allowComma) into unique trimmed values. */
export function parseList(value?: string | null, allowComma = false, max = MAX_TAGS): string[] {
  if (!value) return [];
  const parts = value.split(allowComma ? /[;,|]/ : /[;|]/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const s = p.trim().slice(0, MAX_TAG_LENGTH);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function toStringList(value: unknown, max = MAX_TAGS): string[] {
  if (!Array.isArray(value)) return [];
  const names = value
    .map((v) => (typeof v === 'string' ? v : v && typeof v === 'object' && typeof (v as any).name === 'string' ? (v as any).name : ''))
    .filter(Boolean);
  return parseList(names.join(';'), false, max);
}

function clampStep(n: unknown): number | null {
  const v = typeof n === 'number' ? n : typeof n === 'string' && n.trim() ? Number(n) : NaN;
  return Number.isInteger(v) && v >= 0 && v <= 3 ? v : null;
}

// -----------------------------------------------------------------------------
// Scheduling strategies
// -----------------------------------------------------------------------------

export type ScheduleContext = {
  index: number; // position among valid problems
  today: Date;
  batchSize: number; // problems per day for staggered / archive rechecks
  ladder?: readonly number[];
};

export function scheduleFor(
  strategy: ImportStrategy,
  dateSolved: Date,
  ctx: ScheduleContext,
  original?: ProcessedProblem['original']
): { currentStep: number; status: ProblemStatusValue; nextRevisionAt: Date } {
  const perDay = Math.max(1, ctx.batchSize);

  if (strategy === 'preserve' && original) {
    return {
      currentStep: original.currentStep,
      status: original.status,
      nextRevisionAt: new Date(original.nextRevisionAt),
    };
  }

  if (strategy === 'archive') {
    // Mastered problems come back once for a recheck; spread those so they don't land on one day.
    return {
      currentStep: 3,
      status: 'MASTERED',
      nextRevisionAt: addDays(ctx.today, MASTERY_RECHECK_DAYS + Math.floor(ctx.index / perDay)),
    };
  }

  if (strategy === 'fresh' || strategy === 'preserve') {
    // First review is one ladder step after the solve date, never in the past.
    const initial = getInitialSchedule(dateSolved, normalizeLadder(ctx.ladder));
    const next = initial.nextRevisionAt < ctx.today ? new Date(ctx.today) : initial.nextRevisionAt;
    return { currentStep: 0, status: 'ACTIVE', nextRevisionAt: next };
  }

  return {
    currentStep: 0,
    status: 'ACTIVE',
    nextRevisionAt: computeStaggerSchedule(ctx.index, 0, ctx.today, perDay),
  };
}

/** Re-applies a strategy to already-validated problems (used for backups after the strategy step). */
export function applyStrategy(
  result: ValidationResult,
  strategy: ImportStrategy,
  today: Date = new Date(),
  batchSize = 10,
  ladder?: readonly number[]
): ValidationResult {
  const valid = result.valid.map((p, index) => {
    const s = scheduleFor(strategy, new Date(p.dateSolved), { index, today, batchSize, ladder }, p.original);
    const keepCount = strategy === 'preserve' && p.original?.revisionCount !== undefined;
    return {
      ...p,
      currentStep: s.currentStep,
      status: s.status,
      nextRevisionAt: s.nextRevisionAt.toISOString(),
      revisionCount: keepCount ? p.original!.revisionCount : p.revisions?.length ?? 0,
    };
  });
  return { ...result, valid };
}

export function hasScheduleData(result: ValidationResult): boolean {
  return result.valid.some((p) => !!p.original);
}

// -----------------------------------------------------------------------------
// Full Validation and Row Processing Pipeline
// -----------------------------------------------------------------------------

export async function validateAndProcessRows(
  parsedFile: ParsedFile,
  columnMapping: ColumnMapping,
  strategy: ImportStrategy,
  defaultPlatform: Platform = 'LEETCODE',
  today: Date = new Date(),
  batchSize: number = 10,
  ladder?: readonly number[]
): Promise<ValidationResult> {
  const valid: ProcessedProblem[] = [];
  const warnings: { row: number; message: string }[] = [];
  const errors: { row: number; message: string }[] = [];
  const skipped: { row: number; reason: string }[] = [];

  // Invert mapping for quick column lookup: RecallField -> csvHeader
  const fieldToHeader: Partial<Record<RecallField, string>> = {};
  const customColMappings: { csvCol: string; colName: string }[] = [];

  for (const [csvCol, field] of Object.entries(columnMapping)) {
    if (field !== 'skip') {
      fieldToHeader[field] = csvCol;
      if (typeof field === 'string' && field.startsWith('custom:')) {
        const colName = field.slice(7).trim();
        if (colName) {
          customColMappings.push({ csvCol, colName });
        }
      }
    }
  }

  const customColumns = Array.from(new Set(customColMappings.map((c) => c.colName)));
  const mappedHeaders = Object.keys(columnMapping).filter((col) => columnMapping[col] !== 'skip');
  const seenUniqueKeys = new Set<string>();
  const get = (field: RecallField, row: Record<string, string>) => {
    const h = fieldToHeader[field];
    return h ? (row[h] ?? '').trim() : '';
  };

  if (parsedFile.rows.length > MAX_IMPORT_ROWS) {
    errors.push({ row: 0, message: `Too many rows (${parsedFile.rows.length}). The limit is ${MAX_IMPORT_ROWS}.` });
    return { valid, warnings, errors, skipped, customColumns };
  }

  for (let i = 0; i < parsedFile.rows.length; i++) {
    const rowNum = i + 1; // 1-indexed row number
    const row = parsedFile.rows[i];

    // 1. Skip completely empty rows
    if (isRowEmpty(row, mappedHeaders)) {
      continue;
    }

    // 2. Extract values
    const rawTitle = get('title', row);
    const rawNumber = get('problemNumber', row);
    const rawPlatform = get('platform', row);
    const rawDiff = get('difficulty', row);
    const rawTopic = get('topic', row);
    const rawUrl = get('url', row);
    const rawDate = get('dateSolved', row);
    const rawNotes = get('notes', row);
    const defaulted: string[] = [];

    // 3. Validate Title
    const title = rawTitle;
    if (!title) {
      errors.push({ row: rowNum, message: `Row ${rowNum}: Missing required title` });
      skipped.push({ row: rowNum, reason: `Row ${rowNum}: Missing title` });
      continue;
    }

    // 4. Platform
    let platform: Platform | null = normalizePlatform(rawPlatform);
    if (!platform && rawUrl) {
      platform = detectPlatformFromUrl(rawUrl);
    }
    if (!platform) {
      platform = defaultPlatform;
    }

    // 5. Difficulty
    let difficulty = normalizeDifficulty(rawDiff);
    if (!rawDiff) {
      defaulted.push('difficulty');
      warnings.push({ row: rowNum, message: `Row ${rowNum}: Missing difficulty, defaulted to Medium` });
    }

    // 6. Topic
    let topic = normalizeTopic(rawTopic);
    if (!rawTopic) {
      defaulted.push('topic');
      warnings.push({ row: rowNum, message: `Row ${rowNum}: Missing topic, defaulted to General` });
    }

    // 7. Date Solved
    let dateSolvedDate = rawDate ? tryParseDate(rawDate) : null;
    if (!rawDate) {
      defaulted.push('dateSolved');
      warnings.push({ row: rowNum, message: `Row ${rowNum}: Missing date, defaulted to today` });
    } else if (!dateSolvedDate) {
      defaulted.push('dateSolved');
      warnings.push({ row: rowNum, message: `Row ${rowNum}: Unrecognized date, defaulted to today` });
    }
    if (!dateSolvedDate) dateSolvedDate = new Date(today);

    // 8. URL
    let url = normalizeUrl(rawUrl);
    if (!rawUrl || url === '#') {
      defaulted.push('url');
      warnings.push({ row: rowNum, message: `Row ${rowNum}: Missing URL, placeholder '#' used` });
    }

    // 9. Problem Number
    let problemNumber: number | null = null;
    if (rawNumber && /^\d+$/.test(rawNumber)) {
      problemNumber = parseInt(rawNumber, 10);
    }

    if (!problemNumber && rawUrl) {
      problemNumber = await extractProblemNumberFromUrl(rawUrl, platform);
    }

    if (!problemNumber || problemNumber <= 0) {
      // Auto-generate safe high-range problem number
      problemNumber = 100000 + i;
      warnings.push({
        row: rowNum,
        message: `Row ${rowNum}: Problem number generated (${problemNumber})`,
      });
    }

    // 10. Platform Resolver Enrichment (if title, diff, topic, or url can be enriched)
    try {
      const resolver = getResolver(platform);
      if (resolver) {
        const resolveId = String(problemNumber);
        const res = await resolver.resolve(resolveId);
        if (res.found && res.data) {
          if (!rawDiff && res.data.difficulty) difficulty = res.data.difficulty;
          if (!rawTopic && res.data.topic) topic = res.data.topic;
          if ((!rawUrl || url === '#') && res.data.url) url = res.data.url;
        }
      }
    } catch {}

    // 11. De-duplication within the uploaded file
    const uniqueKey = `${platform}:${problemNumber}`;
    if (seenUniqueKeys.has(uniqueKey)) {
      skipped.push({
        row: rowNum,
        reason: `Row ${rowNum}: Duplicate problem (${platform} #${problemNumber}) in file`,
      });
      continue;
    }
    seenUniqueKeys.add(uniqueKey);

    // 12. Schedule found in the file (Engram CSV export), used by "preserve"
    const rawStatus = get('status', row);
    const rawStep = get('currentStep', row);
    const rawNext = get('nextRevisionAt', row);
    const rawCount = get('revisionCount', row);
    let original: ProcessedProblem['original'];
    if (rawStatus || rawStep || rawNext) {
      const st = parseStatus(rawStatus) ?? 'ACTIVE';
      const next = tryParseDate(rawNext);
      const count = /^\d+$/.test(rawCount) ? parseInt(rawCount, 10) : undefined;
      original = {
        status: st,
        currentStep: clampStep(rawStep) ?? (st === 'ACTIVE' ? 0 : 3),
        nextRevisionAt: (next ?? scheduleFor('fresh', dateSolvedDate, { index: 0, today, batchSize, ladder }).nextRevisionAt).toISOString(),
        revisionCount: count,
      };
    }

    // 13. Scheduling Strategy
    const sched = scheduleFor(strategy, dateSolvedDate, { index: valid.length, today, batchSize, ladder }, original);

    // 14. Extract custom fields if any
    const rowCustomFields: Record<string, string> = {};
    for (const cm of customColMappings) {
      const val = row[cm.csvCol];
      if (val !== undefined && val !== null && String(val).trim()) {
        rowCustomFields[cm.colName] = String(val).trim();
      }
    }

    // 15. Optional round-trip fields
    const extras: Partial<ProcessedProblem> = {};
    const rawCode = get('code', row);
    if (rawCode) extras.code = rawCode.slice(0, 40);
    if (fieldToHeader.tags) extras.tags = parseList(get('tags', row), true);
    if (fieldToHeader.lists) extras.lists = parseList(get('lists', row));
    if (fieldToHeader.isFavorite) extras.isFavorite = parseBoolean(get('isFavorite', row));
    if (original) extras.original = original;
    extras.revisionCount = strategy === 'preserve' && original?.revisionCount !== undefined ? original.revisionCount : 0;

    // 16. Add valid problem
    valid.push({
      platform,
      problemNumber,
      title,
      url,
      difficulty,
      topic,
      dateSolved: dateSolvedDate.toISOString(),
      notes: rawNotes ? rawNotes : null,
      customFields: Object.keys(rowCustomFields).length > 0 ? rowCustomFields : undefined,
      currentStep: sched.currentStep,
      nextRevisionAt: sched.nextRevisionAt.toISOString(),
      status: sched.status,
      ...extras,
      ...(defaulted.length ? { defaulted } : {}),
    });
  }

  return {
    valid,
    warnings,
    errors,
    skipped,
    customColumns,
  };
}

// -----------------------------------------------------------------------------
// JSON backup (GET /api/export) parsing — v2 and the older v1 shape
// -----------------------------------------------------------------------------

export type BackupParseResult =
  | { ok: true; version: 1 | 2; exportedAt: string | null; result: ValidationResult }
  | { ok: false; error: string };

const CONFIDENCES = ['CLEAN', 'SHAKY', 'STRUGGLED'];

function parseRevision(r: any): ImportedRevision | null {
  if (!r || typeof r !== 'object') return null;
  const at = new Date(r.revisedAt);
  if (isNaN(at.getTime()) || !CONFIDENCES.includes(r.confidence)) return null;
  const before = clampStep(r.stepBefore) ?? 0;
  const after = clampStep(r.stepAfter) ?? before;
  return {
    revisedAt: at.toISOString(),
    confidence: r.confidence,
    type: r.type === 'RECHECK' ? 'RECHECK' : 'REGULAR',
    stepBefore: before,
    stepAfter: after,
  };
}

/**
 * Parses an Engram JSON backup.
 * v1 (old export): { exportedAt, user, totalProblems, problems: Problem[] with revisions, streakLogs }
 * v2: { version: 2, exportedAt, preferences, columns, lists, problems (lists as names, revisions nested), streakLogs }
 */
export function parseBackup(text: string, today: Date = new Date()): BackupParseResult {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.problems)) {
    return { ok: false, error: `This JSON file is not a ${siteConfig.name} backup (no "problems" list found).` };
  }
  const version = data.version === undefined ? 1 : Number(data.version);
  if (version !== 1 && version !== 2) {
    return { ok: false, error: `Unsupported backup version ${String(data.version)}. Update ${siteConfig.name} and try again.` };
  }
  if (data.problems.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: `This backup has ${data.problems.length} problems. The limit per import is ${MAX_IMPORT_ROWS}.` };
  }

  const valid: ProcessedProblem[] = [];
  const warnings: { row: number; message: string }[] = [];
  const errors: { row: number; message: string }[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const seen = new Set<string>();

  data.problems.forEach((p: any, i: number) => {
    const row = i + 1;
    const skip = (reason: string) => {
      errors.push({ row, message: `Problem ${row}: ${reason}` });
      skipped.push({ row, reason });
    };
    if (!p || typeof p !== 'object') return skip('Not an object');
    const title = typeof p.title === 'string' ? p.title.trim() : '';
    if (!title) return skip('Missing title');
    if (!VALID_PLATFORMS.includes(p.platform)) return skip(`Unknown platform "${p.platform}"`);
    if (!Number.isInteger(p.problemNumber) || p.problemNumber <= 0) return skip('Invalid problem number');
    const key = `${p.platform}:${p.problemNumber}`;
    if (seen.has(key)) return skip(`Duplicate problem (${p.platform} #${p.problemNumber}) in file`);
    seen.add(key);

    const dateSolved = new Date(p.dateSolved);
    const solved = isNaN(dateSolved.getTime()) ? new Date(today) : dateSolved;
    if (isNaN(dateSolved.getTime())) warnings.push({ row, message: `Problem ${row}: Invalid solve date, defaulted to today` });

    const status = parseStatus(p.status) ?? 'ACTIVE';
    const next = new Date(p.nextRevisionAt);
    const revisions = (Array.isArray(p.revisions) ? p.revisions : [])
      .slice(0, MAX_REVISIONS_PER_PROBLEM)
      .map(parseRevision)
      .filter((r: ImportedRevision | null): r is ImportedRevision => !!r);
    const revisionCount = Number.isInteger(p.revisionCount) && p.revisionCount >= 0 ? p.revisionCount : revisions.length;
    const original = {
      status,
      currentStep: clampStep(p.currentStep) ?? 0,
      nextRevisionAt: isNaN(next.getTime())
        ? scheduleFor('fresh', solved, { index: 0, today, batchSize: 1 }).nextRevisionAt.toISOString()
        : next.toISOString(),
      revisionCount,
    };
    const customFields = readCustomFields(p.customFields);

    valid.push({
      platform: p.platform,
      problemNumber: p.problemNumber,
      title: title.slice(0, 300),
      url: typeof p.url === 'string' && p.url.trim() ? p.url.trim() : '#',
      difficulty: (VALID_DIFFICULTIES as readonly string[]).includes(p.difficulty) ? p.difficulty : 'MEDIUM',
      topic: typeof p.topic === 'string' && p.topic.trim() ? p.topic.trim() : 'General',
      dateSolved: solved.toISOString(),
      notes: typeof p.notes === 'string' && p.notes.trim() ? p.notes : null,
      customFields: Object.keys(customFields).length ? customFields : undefined,
      code: typeof p.code === 'string' && p.code.trim() ? p.code.trim() : null,
      tags: toStringList(p.tags),
      lists: toStringList(p.lists, 100),
      isFavorite: p.isFavorite === true,
      revisions,
      revisionCount,
      original,
      status: original.status,
      currentStep: original.currentStep,
      nextRevisionAt: original.nextRevisionAt,
    });
  });

  // Column definitions: v2 has typed columns; v1 only has customFields keys.
  const columnDefs: ImportColumnDef[] = [];
  const seenCols = new Set<string>();
  const addCol = (name: string, type: ColumnType = 'text', options: string[] = []) => {
    const n = name.trim();
    if (!n || n.length > 40 || seenCols.has(n.toLowerCase())) return;
    seenCols.add(n.toLowerCase());
    columnDefs.push({ name: n, type, options });
  };
  if (Array.isArray(data.columns)) {
    [...data.columns]
      .filter((c: any) => c && typeof c.name === 'string')
      .sort((a: any, b: any) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .forEach((c: any) => {
        const opts = normalizeOptions(c.options);
        addCol(c.name, isColumnType(c.type) ? c.type : 'text', opts.ok ? opts.value : []);
      });
  }
  for (const p of valid) for (const k of Object.keys(p.customFields ?? {})) addCol(k);

  const streakLogs = (Array.isArray(data.streakLogs) ? data.streakLogs : [])
    .map((s: any) => ({ date: typeof s?.date === 'string' ? s.date.slice(0, 10) : '', completed: s?.completed === true }))
    .filter((s: { date: string }) => /^\d{4}-\d{2}-\d{2}$/.test(s.date))
    .slice(0, 5000);

  return {
    ok: true,
    version: version as 1 | 2,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null,
    result: {
      valid,
      warnings,
      errors,
      skipped,
      customColumns: columnDefs.map((c) => c.name),
      columnDefs,
      streakLogs,
    },
  };
}

// -----------------------------------------------------------------------------
// Duplicate handling (server side): overwrite / merge into an existing problem
// -----------------------------------------------------------------------------

export type ExistingProblem = {
  title: string;
  url: string;
  difficulty: string;
  topic: string;
  dateSolved: Date;
  notes: string | null;
  code: string | null;
  tags: string[];
  customFields: unknown;
  isFavorite: boolean;
  status: string;
  currentStep: number;
  nextRevisionAt: Date;
  revisionCount: number;
};

export type ProblemUpdate = {
  title?: string;
  url?: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  topic?: string;
  dateSolved?: Date;
  notes?: string | null;
  code?: string | null;
  tags?: string[];
  customFields?: Record<string, string>;
  isFavorite?: boolean;
  status?: ProblemStatusValue;
  currentStep?: number;
  nextRevisionAt?: Date;
  revisionCount?: number;
};

/** Higher = further along: ACTIVE steps 0-3, then MASTERED/RETIRED. */
export function scheduleRank(status: string, step: number): number {
  return status === 'ACTIVE' ? step : 4;
}

/**
 * overwrite: imported values replace existing ones (fields the file didn't provide are kept).
 * merge: fill only empty fields, union tags, keep the more advanced schedule.
 */
export function buildDuplicateUpdate(
  existing: ExistingProblem,
  incoming: ProcessedProblem & { defaulted?: string[] },
  mode: 'overwrite' | 'merge'
): ProblemUpdate {
  const given = (field: string) => !incoming.defaulted?.includes(field);
  const existingFields = readCustomFields(existing.customFields);
  const incomingFields = incoming.customFields ?? {};
  const out: ProblemUpdate = {};

  if (mode === 'overwrite') {
    out.title = incoming.title;
    if (given('url')) out.url = incoming.url;
    if (given('difficulty')) out.difficulty = incoming.difficulty;
    if (given('topic')) out.topic = incoming.topic;
    if (given('dateSolved')) out.dateSolved = new Date(incoming.dateSolved);
    if (incoming.notes) out.notes = incoming.notes;
    if (incoming.code) out.code = incoming.code;
    if (incoming.tags !== undefined) out.tags = incoming.tags;
    if (incoming.isFavorite !== undefined) out.isFavorite = incoming.isFavorite;
    out.customFields = { ...existingFields, ...incomingFields };
    out.status = incoming.status;
    out.currentStep = incoming.currentStep;
    out.nextRevisionAt = new Date(incoming.nextRevisionAt);
    if (incoming.revisionCount !== undefined) out.revisionCount = incoming.revisionCount;
    return out;
  }

  // merge
  if ((!existing.url || existing.url === '#') && given('url') && incoming.url !== '#') out.url = incoming.url;
  if ((!existing.topic || existing.topic === 'General') && given('topic')) out.topic = incoming.topic;
  if (!existing.notes?.trim() && incoming.notes) out.notes = incoming.notes;
  if (!existing.code?.trim() && incoming.code) out.code = incoming.code;
  if (given('dateSolved')) {
    const d = new Date(incoming.dateSolved);
    if (d < existing.dateSolved) out.dateSolved = d;
  }
  if (incoming.tags?.length) {
    const tags = parseList([...(existing.tags ?? []), ...incoming.tags].join(';'), false, MAX_TAGS);
    if (tags.length !== (existing.tags ?? []).length) out.tags = tags;
  }
  if (incoming.isFavorite && !existing.isFavorite) out.isFavorite = true;

  const mergedFields = { ...existingFields };
  let fieldsChanged = false;
  for (const [k, v] of Object.entries(incomingFields)) {
    if (!mergedFields[k]?.trim() && v) {
      mergedFields[k] = v;
      fieldsChanged = true;
    }
  }
  if (fieldsChanged) out.customFields = mergedFields;

  if (scheduleRank(incoming.status, incoming.currentStep) > scheduleRank(existing.status, existing.currentStep)) {
    out.status = incoming.status;
    out.currentStep = incoming.currentStep;
    out.nextRevisionAt = new Date(incoming.nextRevisionAt);
  }
  const count = incoming.revisionCount ?? 0;
  if (count > existing.revisionCount) out.revisionCount = count;
  return out;
}
