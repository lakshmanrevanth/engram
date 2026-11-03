import { describe, it, expect } from 'vitest';
import {
  normalizeDifficulty,
  parseDate,
  detectPlatformFromUrl,
  normalizePlatform,
  autoDetectMappings,
  normalizeUrl,
  normalizeTopic,
  isRowEmpty,
  computeStaggerSchedule,
  hashString,
  detectFileType,
  validateAndProcessRows,
  parseBackup,
  applyStrategy,
  hasScheduleData,
  buildDuplicateUpdate,
  scheduleRank,
  parseList,
  parseStatus,
  tryParseDate,
  EXPORT_CSV_HEADERS,
  MAX_IMPORT_ROWS,
  type ParsedFile,
  type ColumnMapping,
  type ExistingProblem,
  type ProcessedProblem,
} from './import-utils';
import { MASTERY_RECHECK_DAYS } from './scheduling';

describe('import-utils', () => {
  describe('normalizeDifficulty', () => {
    it('normalizes standard difficulty strings', () => {
      expect(normalizeDifficulty('Easy')).toBe('EASY');
      expect(normalizeDifficulty('easy')).toBe('EASY');
      expect(normalizeDifficulty('EASY')).toBe('EASY');
      expect(normalizeDifficulty('Medium')).toBe('MEDIUM');
      expect(normalizeDifficulty('medium')).toBe('MEDIUM');
      expect(normalizeDifficulty('MEDIUM')).toBe('MEDIUM');
      expect(normalizeDifficulty('Hard')).toBe('HARD');
      expect(normalizeDifficulty('hard')).toBe('HARD');
      expect(normalizeDifficulty('HARD')).toBe('HARD');
    });

    it('normalizes abbreviations and numeric ratings', () => {
      expect(normalizeDifficulty('E')).toBe('EASY');
      expect(normalizeDifficulty('M')).toBe('MEDIUM');
      expect(normalizeDifficulty('H')).toBe('HARD');
      expect(normalizeDifficulty('1')).toBe('EASY');
      expect(normalizeDifficulty('2')).toBe('MEDIUM');
      expect(normalizeDifficulty('3')).toBe('HARD');
    });

    it('normalizes common synonyms', () => {
      expect(normalizeDifficulty('Simple')).toBe('EASY');
      expect(normalizeDifficulty('Basic')).toBe('EASY');
      expect(normalizeDifficulty('Moderate')).toBe('MEDIUM');
      expect(normalizeDifficulty('Intermediate')).toBe('MEDIUM');
      expect(normalizeDifficulty('Difficult')).toBe('HARD');
      expect(normalizeDifficulty('Advanced')).toBe('HARD');
      expect(normalizeDifficulty('Expert')).toBe('HARD');
    });

    it('handles mixed casing and whitespace', () => {
      expect(normalizeDifficulty('  eAsY  ')).toBe('EASY');
      expect(normalizeDifficulty('  mEdIuM  ')).toBe('MEDIUM');
      expect(normalizeDifficulty('  hArD  ')).toBe('HARD');
    });

    it('defaults to MEDIUM for empty or unrecognized values', () => {
      expect(normalizeDifficulty('')).toBe('MEDIUM');
      expect(normalizeDifficulty('   ')).toBe('MEDIUM');
      expect(normalizeDifficulty(null)).toBe('MEDIUM');
      expect(normalizeDifficulty(undefined)).toBe('MEDIUM');
      expect(normalizeDifficulty('Unknown')).toBe('MEDIUM');
      expect(normalizeDifficulty('Insane')).toBe('MEDIUM');
    });
  });

  describe('parseDate', () => {
    it('parses standard ISO dates', () => {
      const d = parseDate('2024-01-15');
      expect(d.getFullYear()).toBe(2024);
      expect(d.getMonth()).toBe(0); // Jan is 0
      expect(d.getDate()).toBe(15);
    });

    it('parses US formatted dates MM/DD/YYYY', () => {
      const d = parseDate('01/15/2024');
      expect(d.getFullYear()).toBe(2024);
      expect(d.getMonth()).toBe(0);
      expect(d.getDate()).toBe(15);
    });

    it('parses EU formatted dates DD/MM/YYYY when day > 12', () => {
      const d = parseDate('25/01/2024');
      expect(d.getFullYear()).toBe(2024);
      expect(d.getMonth()).toBe(0);
      expect(d.getDate()).toBe(25);
    });

    it('parses natural language dates', () => {
      const d = parseDate('Jan 15, 2024');
      expect(d.getFullYear()).toBe(2024);
      expect(d.getMonth()).toBe(0);
      expect(d.getDate()).toBe(15);
    });

    it('parses unix timestamp in milliseconds', () => {
      const timestamp = 1705276800000; // Jan 15 2024 00:00:00 UTC
      const d = parseDate(String(timestamp));
      expect(d.getTime()).toBe(timestamp);
    });

    it('parses Excel serial date numbers', () => {
      // Excel 45306 is ~2024-01-15
      const d = parseDate('45306');
      expect(d.getFullYear()).toBe(2024);
      expect(d.getMonth()).toBe(0);
      expect(d.getDate()).toBe(15);
    });

    it('defaults to today for empty, invalid, or garbage input', () => {
      const before = Date.now();
      const d1 = parseDate('');
      const d2 = parseDate(null);
      const d3 = parseDate('not-a-valid-date');
      const after = Date.now();

      expect(d1.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(d1.getTime()).toBeLessThanOrEqual(after + 1000);
      expect(d2.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(d3.getTime()).toBeGreaterThanOrEqual(before - 1000);
    });
  });

  describe('detectPlatformFromUrl', () => {
    it('detects LeetCode URLs', () => {
      expect(detectPlatformFromUrl('https://leetcode.com/problems/two-sum/')).toBe('LEETCODE');
      expect(detectPlatformFromUrl('http://www.leetcode.com/problems/3sum')).toBe('LEETCODE');
      expect(detectPlatformFromUrl('leetcode.com/problems/two-sum')).toBe('LEETCODE');
    });

    it('detects Codeforces URLs', () => {
      expect(detectPlatformFromUrl('https://codeforces.com/problemset/problem/4/A')).toBe('CODEFORCES');
      expect(detectPlatformFromUrl('https://www.codeforces.com/contest/158/problem/A')).toBe('CODEFORCES');
    });

    it('detects GFG URLs', () => {
      expect(detectPlatformFromUrl('https://www.geeksforgeeks.org/problems/kadanes-algorithm/1')).toBe('GFG');
      expect(detectPlatformFromUrl('https://practice.geeksforgeeks.org/problems/two-sum')).toBe('GFG');
    });

    it('detects HackerRank URLs', () => {
      expect(detectPlatformFromUrl('https://www.hackerrank.com/challenges/solve-me-first/problem')).toBe('HACKERRANK');
    });

    it('detects CodeChef URLs', () => {
      expect(detectPlatformFromUrl('https://www.codechef.com/problems/FLOW001')).toBe('CODECHEF');
    });

    it('returns null for unknown platforms or null values', () => {
      expect(detectPlatformFromUrl('https://interviewbit.com/problems/two-sum')).toBeNull();
      expect(detectPlatformFromUrl('https://example.com')).toBeNull();
      expect(detectPlatformFromUrl('')).toBeNull();
      expect(detectPlatformFromUrl(null)).toBeNull();
    });
  });

  describe('normalizePlatform', () => {
    it('normalizes LeetCode variations', () => {
      expect(normalizePlatform('leetcode')).toBe('LEETCODE');
      expect(normalizePlatform('LEETCODE')).toBe('LEETCODE');
      expect(normalizePlatform('Leet Code')).toBe('LEETCODE');
      expect(normalizePlatform('lc')).toBe('LEETCODE');
    });

    it('normalizes Codeforces variations', () => {
      expect(normalizePlatform('codeforces')).toBe('CODEFORCES');
      expect(normalizePlatform('CODEFORCES')).toBe('CODEFORCES');
      expect(normalizePlatform('cf')).toBe('CODEFORCES');
    });

    it('normalizes GFG variations', () => {
      expect(normalizePlatform('gfg')).toBe('GFG');
      expect(normalizePlatform('geeksforgeeks')).toBe('GFG');
      expect(normalizePlatform('geeks for geeks')).toBe('GFG');
    });

    it('normalizes HackerRank variations', () => {
      expect(normalizePlatform('hackerrank')).toBe('HACKERRANK');
      expect(normalizePlatform('hr')).toBe('HACKERRANK');
    });

    it('normalizes CodeChef variations', () => {
      expect(normalizePlatform('codechef')).toBe('CODECHEF');
      expect(normalizePlatform('cc')).toBe('CODECHEF');
    });

    it('returns null for unsupported platforms', () => {
      expect(normalizePlatform('interviewbit')).toBeNull();
      expect(normalizePlatform('')).toBeNull();
      expect(normalizePlatform(null)).toBeNull();
    });
  });

  describe('autoDetectMappings', () => {
    it('maps common headers correctly', () => {
      const headers = ['Problem', 'Difficulty', 'Link', 'Topic'];
      const mapping = autoDetectMappings(headers);
      expect(mapping['Problem']).toBe('title');
      expect(mapping['Difficulty']).toBe('difficulty');
      expect(mapping['Link']).toBe('url');
      expect(mapping['Topic']).toBe('topic');
    });

    it('maps number and question headers', () => {
      const headers = ['S.No', 'Question Name', 'URL', 'Platform', 'Notes'];
      const mapping = autoDetectMappings(headers);
      expect(mapping['S.No']).toBe('problemNumber');
      expect(mapping['Question Name']).toBe('title');
      expect(mapping['URL']).toBe('url');
      expect(mapping['Platform']).toBe('platform');
      expect(mapping['Notes']).toBe('notes');
    });

    it('directly maps non-standard column headers as custom columns', () => {
      const headers = ['Language', 'Company Target', ' '];
      const mapping = autoDetectMappings(headers);
      expect(mapping['Language']).toBe('custom:Language');
      expect(mapping['Company Target']).toBe('custom:Company Target');
      expect(mapping[' ']).toBe('skip');
    });

    it('assigns first matching column and avoids duplicate mapping of the same field', () => {
      const headers = ['Title', 'Title2', 'Question'];
      const mapping = autoDetectMappings(headers);
      expect(mapping['Title']).toBe('title');
      expect(mapping['Title2']).toBe('custom:Title2');
      expect(mapping['Question']).toBe('custom:Question');
    });
  });

  describe('normalizeUrl', () => {
    it('preserves complete HTTP and HTTPS URLs', () => {
      expect(normalizeUrl('https://leetcode.com/problems/two-sum/')).toBe('https://leetcode.com/problems/two-sum/');
      expect(normalizeUrl('http://example.com')).toBe('http://example.com');
    });

    it('prepends https:// when protocol is omitted', () => {
      expect(normalizeUrl('leetcode.com/problems/two-sum/')).toBe('https://leetcode.com/problems/two-sum/');
    });

    it('returns # for invalid or empty URLs', () => {
      expect(normalizeUrl('')).toBe('#');
      expect(normalizeUrl('   ')).toBe('#');
      expect(normalizeUrl(null)).toBe('#');
      expect(normalizeUrl('random-text-without-domain')).toBe('#');
    });
  });

  describe('normalizeTopic', () => {
    it('converts to title case', () => {
      expect(normalizeTopic('dynamic programming')).toBe('Dynamic Programming');
      expect(normalizeTopic('ARRAYS')).toBe('Arrays');
      expect(normalizeTopic('binary search trees')).toBe('Binary Search Trees');
    });

    it('defaults to General for empty input', () => {
      expect(normalizeTopic('')).toBe('General');
      expect(normalizeTopic('  ')).toBe('General');
      expect(normalizeTopic(null)).toBe('General');
    });
  });

  describe('isRowEmpty', () => {
    it('returns true when all fields are empty or whitespace', () => {
      expect(isRowEmpty({ col1: '', col2: '  ', col3: '' })).toBe(true);
    });

    it('returns false when at least one field has content', () => {
      expect(isRowEmpty({ col1: '', col2: 'Two Sum', col3: '' })).toBe(false);
    });

    it('checks only specified mapped fields if provided', () => {
      expect(isRowEmpty({ col1: 'ignored-garbage', col2: '' }, ['col2'])).toBe(true);
      expect(isRowEmpty({ col1: 'ignored-garbage', col2: 'valid' }, ['col2'])).toBe(false);
    });
  });

  describe('computeStaggerSchedule', () => {
    const today = new Date('2024-01-01T00:00:00.000Z');

    it('assigns day 0 offset for the first batch', () => {
      const d0 = computeStaggerSchedule(0, 50, today, 10);
      const d9 = computeStaggerSchedule(9, 50, today, 10);
      expect(d0.getDate()).toBe(1);
      expect(d9.getDate()).toBe(1);
    });

    it('assigns day 1 offset for the second batch', () => {
      const d10 = computeStaggerSchedule(10, 50, today, 10);
      const d19 = computeStaggerSchedule(19, 50, today, 10);
      expect(d10.getDate()).toBe(2);
      expect(d19.getDate()).toBe(2);
    });

    it('assigns correct offset for large indices', () => {
      const d100 = computeStaggerSchedule(100, 200, today, 10);
      expect(d100.getDate()).toBe(11); // 10 days after Jan 1
    });
  });

  describe('hashString', () => {
    it('produces consistent non-negative integer hashes', () => {
      const h1 = hashString('two-sum');
      const h2 = hashString('two-sum');
      const h3 = hashString('3sum');

      expect(h1).toBe(h2);
      expect(typeof h1).toBe('number');
      expect(h1).toBeGreaterThanOrEqual(0);
      expect(h1).not.toBe(h3);
    });
  });

  describe('detectFileType', () => {
    it('detects csv files', () => {
      const file = new File([''], 'problems.csv', { type: 'text/csv' });
      expect(detectFileType(file)).toBe('csv');
    });

    it('detects xlsx and xls files', () => {
      const xlsxFile = new File([''], 'problems.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const xlsFile = new File([''], 'problems.xls', { type: 'application/vnd.ms-excel' });
      expect(detectFileType(xlsxFile)).toBe('excel');
      expect(detectFileType(xlsFile)).toBe('excel');
    });

    it('returns unsupported for other file types', () => {
      const pdf = new File([''], 'doc.pdf', { type: 'application/pdf' });
      expect(detectFileType(pdf)).toBe('unsupported');
    });
  });

  describe('validateAndProcessRows', () => {
    const parsedFile: ParsedFile = {
      headers: ['#', 'Title', 'Diff', 'Topic', 'URL', 'Date'],
      rows: [
        {
          '#': '1',
          Title: 'Two Sum',
          Diff: 'Easy',
          Topic: 'Arrays',
          URL: 'https://leetcode.com/problems/two-sum/',
          Date: '2024-01-15',
        },
        {
          '#': '2',
          Title: 'Add Two Numbers',
          Diff: '',
          Topic: '',
          URL: '',
          Date: '',
        },
        {
          '#': '3',
          Title: '',
          Diff: 'Hard',
          Topic: 'DP',
          URL: '',
          Date: '',
        },
        {
          '#': '1',
          Title: 'Two Sum Duplicate',
          Diff: 'Easy',
          Topic: 'Arrays',
          URL: 'https://leetcode.com/problems/two-sum/',
          Date: '2024-01-15',
        },
      ],
      totalRows: 4,
    };

    const mapping: ColumnMapping = {
      '#': 'problemNumber',
      Title: 'title',
      Diff: 'difficulty',
      Topic: 'topic',
      URL: 'url',
      Date: 'dateSolved',
    };

    it('correctly processes rows with fallbacks, skips missing titles, and removes duplicates', async () => {
      const res = await validateAndProcessRows(parsedFile, mapping, 'staggered', 'LEETCODE');

      // Row 1: Valid
      // Row 2: Valid with defaults (diff -> MEDIUM, topic -> General, url -> #, date -> today)
      // Row 3: Skipped (no title)
      // Row 4: Skipped (duplicate #1 on LeetCode)
      expect(res.valid.length).toBe(2);
      expect(res.valid[0].problemNumber).toBe(1);
      expect(res.valid[0].title).toBe('Two Sum');
      expect(res.valid[0].difficulty).toBe('EASY');

      expect(res.valid[1].problemNumber).toBe(2);
      expect(res.valid[1].difficulty).toBe('MEDIUM');
      expect(res.valid[1].topic).toBe('General');

      // Check warnings and errors
      expect(res.warnings.length).toBeGreaterThan(0);
      expect(res.errors.length).toBe(1); // Row 3
      expect(res.skipped.length).toBe(2); // Row 3 and Row 4
    });

    it('applies archive strategy: mastered with a spread-out recheck after MASTERY_RECHECK_DAYS', async () => {
      const today = new Date('2024-01-01T00:00:00.000Z');
      const res = await validateAndProcessRows(parsedFile, mapping, 'archive', 'LEETCODE', today, 1);
      expect(res.valid[0].status).toBe('MASTERED');
      expect(res.valid[0].currentStep).toBe(3);
      const d0 = new Date(res.valid[0].nextRevisionAt).getTime();
      const d1 = new Date(res.valid[1].nextRevisionAt).getTime();
      expect(Math.round((d0 - today.getTime()) / 86400000)).toBe(MASTERY_RECHECK_DAYS);
      expect(Math.round((d1 - d0) / 86400000)).toBe(1);
    });

    it('applies fresh strategy from each row’s solve date', async () => {
      const today = new Date('2024-01-01T00:00:00.000Z');
      const res = await validateAndProcessRows(parsedFile, mapping, 'fresh', 'LEETCODE', today);
      expect(res.valid[0].status).toBe('ACTIVE');
      expect(res.valid[0].currentStep).toBe(0);
      // Solved 2024-01-15 + 3 days
      expect(new Date(res.valid[0].nextRevisionAt).getUTCDate()).toBe(18);
      // Row 2 has no date → solved "today" → today + 3
      expect(new Date(res.valid[1].nextRevisionAt).getUTCDate()).toBe(4);
    });

    it('fresh strategy uses the user ladder and never schedules in the past', async () => {
      const today = new Date('2024-03-01T00:00:00.000Z');
      const res = await validateAndProcessRows(parsedFile, mapping, 'fresh', 'LEETCODE', today, 10, [5, 10, 20, 40]);
      // 2024-01-15 + 5 is before today → clamped to today
      expect(res.valid[0].nextRevisionAt).toBe(today.toISOString());
      const later = new Date('2024-01-10T00:00:00.000Z');
      const res2 = await validateAndProcessRows(parsedFile, mapping, 'fresh', 'LEETCODE', later, 10, [5, 10, 20, 40]);
      expect(new Date(res2.valid[0].nextRevisionAt).getUTCDate()).toBe(20);
    });

    it('applies staggered strategy with custom daily pace', async () => {
      const today = new Date('2024-01-01T00:00:00.000Z');
      // With daily pace of 1, problem 0 is day 0 (Jan 1) and problem 1 is day 1 (Jan 2)
      const res = await validateAndProcessRows(parsedFile, mapping, 'staggered', 'LEETCODE', today, 1);
      const due0 = new Date(res.valid[0].nextRevisionAt);
      const due1 = new Date(res.valid[1].nextRevisionAt);
      expect(due0.getUTCDate()).toBe(1);
      expect(due1.getUTCDate()).toBe(2);
    });

    it('extracts custom columns and stores them in customFields', async () => {
      const fileWithCustomCols: ParsedFile = {
        headers: ['#', 'Title', 'Language', 'Company Target'],
        rows: [
          {
            '#': '1',
            Title: 'Two Sum',
            Language: 'Python3',
            'Company Target': 'Google',
          },
          {
            '#': '2',
            Title: 'Add Two Numbers',
            Language: 'C++',
            'Company Target': '',
          },
        ],
        totalRows: 2,
      };

      const customMapping: ColumnMapping = {
        '#': 'problemNumber',
        Title: 'title',
        Language: 'custom:Language',
        'Company Target': 'custom:Company Target',
      };

      const res = await validateAndProcessRows(fileWithCustomCols, customMapping, 'staggered', 'LEETCODE');
      expect(res.valid.length).toBe(2);
      expect(res.customColumns).toEqual(['Language', 'Company Target']);
      expect(res.valid[0].customFields).toEqual({
        Language: 'Python3',
        'Company Target': 'Google',
      });
      expect(res.valid[1].customFields).toEqual({
        Language: 'C++',
      });
    });

    it('auto-detects existing custom columns when provided', () => {
      const headers = ['Title', 'Language', 'Approach'];
      const mapping = autoDetectMappings(headers, ['Language', 'Approach']);
      expect(mapping['Title']).toBe('title');
      expect(mapping['Language']).toBe('custom:Language');
      expect(mapping['Approach']).toBe('custom:Approach');
    });
  });

  describe('round-trip fields', () => {
    it('auto-detects every header written by the CSV export', () => {
      const headers = [...EXPORT_CSV_HEADERS.map((h) => h.header), 'Language'];
      const mapping = autoDetectMappings(headers, ['Language']);
      for (const h of EXPORT_CSV_HEADERS) expect(mapping[h.header]).toBe(h.field);
      expect(mapping['Language']).toBe('custom:Language');
    });

    it('detects .json backups', () => {
      expect(detectFileType(new File(['{}'], 'recall_backup.json'))).toBe('json');
    });

    it('parses lists, statuses and dates', () => {
      expect(parseList('dp; Graphs | dp , x')).toEqual(['dp', 'Graphs', 'dp , x']);
      expect(parseList('a, b; A', true)).toEqual(['a', 'b']);
      expect(parseStatus('mastered')).toBe('MASTERED');
      expect(parseStatus('solved')).toBeNull();
      expect(tryParseDate('nonsense')).toBeNull();
      expect(tryParseDate('')).toBeNull();
      expect(tryParseDate('2024-05-01')?.toISOString()).toBe('2024-05-01T00:00:00.000Z');
    });

    const exportCsv: ParsedFile = {
      headers: ['Title', 'Platform', 'Number', 'Code', 'Tags', 'Status', 'Step', 'Next Revision', 'Revision Count', 'Favorite', 'Lists', 'Date Solved'],
      rows: [
        {
          Title: 'Watermelon', Platform: 'CODEFORCES', Number: '4', Code: '4A', Tags: 'math; brute force',
          Status: 'ACTIVE', Step: '2', 'Next Revision': '2024-02-10', 'Revision Count': '3', Favorite: 'yes',
          Lists: 'Blind 75; Warmups', 'Date Solved': '2024-01-01',
        },
        { Title: 'No schedule', Platform: 'LEETCODE', Number: '9', Code: '', Tags: '', Status: '', Step: '', 'Next Revision': '', 'Revision Count': '', Favorite: '', Lists: '', 'Date Solved': '2024-01-01' },
      ],
      totalRows: 2,
    };

    it('keeps schedule from a Recall CSV with the preserve strategy', async () => {
      const today = new Date('2024-02-01T00:00:00.000Z');
      const mapping = autoDetectMappings(exportCsv.headers);
      const res = await validateAndProcessRows(exportCsv, mapping, 'preserve', 'LEETCODE', today);
      const [a, b] = res.valid;
      expect(a.code).toBe('4A');
      expect(a.tags).toEqual(['math', 'brute force']);
      expect(a.lists).toEqual(['Blind 75', 'Warmups']);
      expect(a.isFavorite).toBe(true);
      expect(a.currentStep).toBe(2);
      expect(a.nextRevisionAt).toBe('2024-02-10T00:00:00.000Z');
      expect(a.revisionCount).toBe(3);
      // Row without schedule data falls back to "fresh" (clamped to today)
      expect(b.original).toBeUndefined();
      expect(b.status).toBe('ACTIVE');
      expect(b.nextRevisionAt).toBe(today.toISOString());
      expect(hasScheduleData(res)).toBe(true);
    });

    it('rejects files over the row limit', async () => {
      const big: ParsedFile = { headers: ['Title'], rows: Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ({ Title: `P${i}` })), totalRows: MAX_IMPORT_ROWS + 1 };
      const res = await validateAndProcessRows(big, { Title: 'title' }, 'staggered');
      expect(res.valid).toHaveLength(0);
      expect(res.errors[0].message).toContain('Too many rows');
    });
  });

  describe('parseBackup', () => {
    const v1 = {
      exportedAt: '2024-05-01T00:00:00.000Z',
      user: { id: 'u1', name: 'A', email: 'a@x.com' },
      totalProblems: 2,
      problems: [
        {
          id: 'p1', userId: 'u1', platform: 'LEETCODE', problemNumber: 1, title: 'Two Sum', url: 'https://leetcode.com/problems/two-sum/',
          difficulty: 'EASY', topic: 'Arrays', dateSolved: '2024-01-01T00:00:00.000Z', notes: 'hash map',
          customFields: { Language: 'Go' }, isFavorite: true, status: 'MASTERED', currentStep: 3,
          nextRevisionAt: '2024-08-01T00:00:00.000Z', revisionCount: 4, createdAt: '2024-01-01T00:00:00.000Z',
          revisions: [
            { id: 'r1', problemId: 'p1', revisedAt: '2024-01-04T00:00:00.000Z', confidence: 'CLEAN', type: 'REGULAR', stepBefore: 0, stepAfter: 1 },
            { id: 'r2', problemId: 'p1', revisedAt: 'bad', confidence: 'CLEAN', type: 'REGULAR', stepBefore: 1, stepAfter: 2 },
          ],
        },
        { platform: 'NOPE', problemNumber: 2, title: 'Bad', difficulty: 'EASY' },
      ],
      streakLogs: [{ id: 's1', userId: 'u1', date: '2024-01-04T00:00:00.000Z', completed: true }],
    };

    it('reads the v1 shape (old export) with schedule, revisions and derived columns', () => {
      const r = parseBackup(JSON.stringify(v1));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.version).toBe(1);
      const p = r.result.valid[0];
      expect(p.status).toBe('MASTERED');
      expect(p.currentStep).toBe(3);
      expect(p.revisionCount).toBe(4);
      expect(p.revisions).toHaveLength(1);
      expect(p.customFields).toEqual({ Language: 'Go' });
      expect(r.result.columnDefs).toEqual([{ name: 'Language', type: 'text', options: [] }]);
      expect(r.result.skipped).toHaveLength(1);
      expect(r.result.streakLogs).toEqual([{ date: '2024-01-04', completed: true }]);
    });

    it('reads v2 with typed columns, lists, tags and code', () => {
      const v2 = {
        version: 2,
        exportedAt: '2024-05-01T00:00:00.000Z',
        columns: [
          { name: 'Status2', type: 'select', options: ['Todo', 'Done'], order: 1 },
          { name: 'Link', type: 'url', options: [], order: 0 },
        ],
        lists: ['Blind 75'],
        problems: [
          {
            platform: 'CODEFORCES', problemNumber: 4, code: '4A', title: 'Watermelon', url: '#', difficulty: 'EASY', topic: 'Math',
            tags: ['math', 'Math', 7], dateSolved: '2024-01-01T00:00:00.000Z', notes: null, customFields: { Status2: 'Done' },
            isFavorite: false, status: 'ACTIVE', currentStep: 1, nextRevisionAt: '2024-01-08T00:00:00.000Z', revisionCount: 1,
            lists: ['Blind 75'], revisions: [],
          },
        ],
        streakLogs: [],
      };
      const r = parseBackup(JSON.stringify(v2));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.version).toBe(2);
      expect(r.result.columnDefs?.map((c) => c.name)).toEqual(['Link', 'Status2']);
      expect(r.result.columnDefs?.[1]).toEqual({ name: 'Status2', type: 'select', options: ['Todo', 'Done'] });
      const p = r.result.valid[0];
      expect(p.code).toBe('4A');
      expect(p.tags).toEqual(['math']);
      expect(p.lists).toEqual(['Blind 75']);
      expect(p.original?.nextRevisionAt).toBe('2024-01-08T00:00:00.000Z');
    });

    it('rejects invalid JSON, wrong shapes, unknown versions and oversized backups', () => {
      expect(parseBackup('{oops').ok).toBe(false);
      expect(parseBackup('{"foo":1}').ok).toBe(false);
      expect(parseBackup('{"version":9,"problems":[]}').ok).toBe(false);
      const big = { version: 2, problems: Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ({})) };
      const r = parseBackup(JSON.stringify(big));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain('limit');
    });

    it('applyStrategy re-schedules backups unless preserving', () => {
      const r = parseBackup(JSON.stringify(v1));
      if (!r.ok) throw new Error('parse failed');
      const today = new Date('2024-06-01T00:00:00.000Z');
      const kept = applyStrategy(r.result, 'preserve', today);
      expect(kept.valid[0].nextRevisionAt).toBe('2024-08-01T00:00:00.000Z');
      expect(kept.valid[0].revisionCount).toBe(4);
      const fresh = applyStrategy(r.result, 'staggered', today, 5);
      expect(fresh.valid[0].status).toBe('ACTIVE');
      expect(fresh.valid[0].currentStep).toBe(0);
      expect(fresh.valid[0].revisionCount).toBe(1); // history kept, count from restored revisions
    });
  });

  describe('buildDuplicateUpdate', () => {
    const existing: ExistingProblem = {
      title: 'Two Sum', url: '#', difficulty: 'EASY', topic: 'General', dateSolved: new Date('2024-03-01T00:00:00.000Z'),
      notes: 'mine', code: null, tags: ['hash'], customFields: { Language: 'Go', Empty: '' }, isFavorite: false,
      status: 'ACTIVE', currentStep: 1, nextRevisionAt: new Date('2024-03-08T00:00:00.000Z'), revisionCount: 2,
    };
    const incoming: ProcessedProblem = {
      platform: 'LEETCODE', problemNumber: 1, title: 'Two Sum (new)', url: 'https://leetcode.com/problems/two-sum/',
      difficulty: 'MEDIUM', topic: 'Arrays', dateSolved: '2024-01-01T00:00:00.000Z', notes: 'theirs', code: 'TS',
      tags: ['Arrays', 'HASH'], customFields: { Language: 'Rust', Empty: 'filled' }, isFavorite: true,
      status: 'ACTIVE', currentStep: 3, nextRevisionAt: '2024-04-01T00:00:00.000Z', revisionCount: 5,
    };

    it('merge fills empty fields, unions tags and keeps the more advanced schedule', () => {
      const u = buildDuplicateUpdate(existing, incoming, 'merge');
      expect(u.title).toBeUndefined();
      expect(u.url).toBe(incoming.url);
      expect(u.topic).toBe('Arrays');
      expect(u.notes).toBeUndefined();
      expect(u.code).toBe('TS');
      expect(u.tags).toEqual(['hash', 'Arrays']);
      expect(u.customFields).toEqual({ Language: 'Go', Empty: 'filled' });
      expect(u.isFavorite).toBe(true);
      expect(u.dateSolved?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      expect(u.currentStep).toBe(3);
      expect(u.revisionCount).toBe(5);
    });

    it('merge keeps the existing schedule when it is further along', () => {
      const u = buildDuplicateUpdate({ ...existing, status: 'MASTERED', currentStep: 3 }, incoming, 'merge');
      expect(u.status).toBeUndefined();
      expect(u.nextRevisionAt).toBeUndefined();
      expect(scheduleRank('MASTERED', 3)).toBeGreaterThan(scheduleRank('ACTIVE', 3));
    });

    it('overwrite replaces values but leaves defaulted fields alone', () => {
      const u = buildDuplicateUpdate(
        { ...existing, url: 'https://keep.me/' },
        { ...incoming, url: '#', defaulted: ['url', 'topic'] },
        'overwrite'
      );
      expect(u.title).toBe('Two Sum (new)');
      expect(u.url).toBeUndefined();
      expect(u.topic).toBeUndefined();
      expect(u.notes).toBe('theirs');
      expect(u.tags).toEqual(['Arrays', 'HASH']);
      expect(u.customFields).toEqual({ Language: 'Rust', Empty: 'filled' });
      expect(u.currentStep).toBe(3);
      expect(u.nextRevisionAt?.toISOString()).toBe('2024-04-01T00:00:00.000Z');
    });
  });
});
