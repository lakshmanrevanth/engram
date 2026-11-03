import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { csvCell, guardFormula } from './format';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { parseBackup, autoDetectMappings } from '@/lib/import-utils';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    problem: { findMany: vi.fn() },
    userColumnConfig: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    problemList: { findMany: vi.fn() },
    streakLog: { findMany: vi.fn() },
  },
}));

const db = prisma as any;

const problem = {
  id: 'p1',
  userId: 'u1',
  platform: 'LEETCODE',
  problemNumber: 1,
  code: null,
  title: '=HYPERLINK("http://evil")',
  url: 'https://leetcode.com/problems/two-sum/',
  difficulty: 'EASY',
  topic: 'Arrays',
  tags: ['hash', 'array'],
  dateSolved: new Date('2024-01-01T00:00:00.000Z'),
  notes: 'line1\nline "2"',
  customFields: { Language: '+cmd', Done: 'true' },
  isFavorite: true,
  status: 'ACTIVE',
  currentStep: 2,
  nextRevisionAt: new Date('2024-02-01T00:00:00.000Z'),
  revisionCount: 3,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  lists: [{ name: 'Blind 75' }],
  revisions: [
    { id: 'r1', problemId: 'p1', revisedAt: new Date('2024-01-04T00:00:00.000Z'), confidence: 'CLEAN', type: 'REGULAR', stepBefore: 0, stepAfter: 1 },
  ],
};

const columns = [
  { id: 'c1', userId: 'u1', name: 'Language', type: 'text', options: null, order: 0, createdAt: new Date() },
  { id: 'c2', userId: 'u1', name: 'Done', type: 'checkbox', options: null, order: 1, createdAt: new Date() },
];

describe('/api/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
    db.problem.findMany.mockResolvedValue([problem]);
    db.userColumnConfig.findMany.mockResolvedValue(columns);
    db.user.findUnique.mockResolvedValue({
      name: 'A', email: 'a@x.com', timezone: 'Asia/Kolkata', dailyGoal: 5, defaultPlatform: 'LEETCODE', ladderDays: [3, 7, 14, 30], goalBasedStreak: false,
    });
    db.problemList.findMany.mockResolvedValue([{ name: 'Blind 75' }, { name: 'Unused' }]);
    db.streakLog.findMany.mockResolvedValue([{ id: 's', userId: 'u1', date: new Date('2024-01-04T00:00:00.000Z'), completed: true }]);
  });

  it('401 when signed out', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    expect((await GET(new NextRequest('http://x/api/export'))).status).toBe(401);
  });

  it('400 for unknown format', async () => {
    expect((await GET(new NextRequest('http://x/api/export?format=xml'))).status).toBe(400);
  });

  it('guards spreadsheet formulas', () => {
    for (const s of ['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx']) expect(guardFormula(s).startsWith("'")).toBe(true);
    expect(guardFormula('Two Sum')).toBe('Two Sum');
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(null)).toBe('');
  });

  it('JSON backup is v2 and round-trips through parseBackup', async () => {
    const res = await GET(new NextRequest('http://x/api/export'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('recall_backup_');
    const text = await res.text();
    const data = JSON.parse(text);
    expect(data.version).toBe(2);
    expect(data.preferences.ladderDays).toEqual([3, 7, 14, 30]);
    expect(data.columns).toEqual([
      { name: 'Language', type: 'text', options: [], order: 0 },
      { name: 'Done', type: 'checkbox', options: [], order: 1 },
    ]);
    expect(data.lists).toEqual(['Blind 75', 'Unused']);
    expect(data.problems[0].lists).toEqual(['Blind 75']);
    expect(data.problems[0].revisions).toHaveLength(1);
    expect(data.streakLogs).toEqual([{ date: '2024-01-04', completed: true }]);

    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const p = parsed.result.valid[0];
    expect(p.currentStep).toBe(2);
    expect(p.nextRevisionAt).toBe('2024-02-01T00:00:00.000Z');
    expect(p.tags).toEqual(['hash', 'array']);
    expect(parsed.result.columnDefs?.[1].type).toBe('checkbox');
  });

  it('CSV has all fields, custom columns, and escapes formulas', async () => {
    const res = await GET(new NextRequest('http://x/api/export?format=csv'));
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    const text = (await res.text()).replace(/^﻿/, '');
    const [header, ...rest] = text.split('\r\n');
    const headers = header.split(',');
    expect(headers).toContain('Next Revision');
    expect(headers.slice(-2)).toEqual(['Language', 'Done']);
    const mapping = autoDetectMappings(headers, ['Language', 'Done']);
    expect(mapping['Next Revision']).toBe('nextRevisionAt');
    const row = rest.join('\r\n');
    expect(row).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(row).toContain("'+cmd");
    expect(row).toContain('hash; array');
    expect(row).toContain('Blind 75');
    expect(row).toContain('2024-02-01');
  });

  it('exports only the given ids (GET and POST), without streak logs', async () => {
    await GET(new NextRequest('http://x/api/export?ids=p1,p2,p1'));
    expect(db.problem.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1', id: { in: ['p1', 'p2'] } });

    const res = await POST(
      new NextRequest('http://x/api/export', { method: 'POST', body: JSON.stringify({ format: 'json', ids: ['p1'] }) })
    );
    const data = await res.json();
    expect(data.partial).toBe(true);
    expect(data.streakLogs).toEqual([]);
    expect(data.lists).toEqual(['Blind 75']);
    expect(res.headers.get('Content-Disposition')).toContain('_selection_');
  });

  it('rejects empty or malformed id lists', async () => {
    expect((await GET(new NextRequest('http://x/api/export?ids=,,'))).status).toBe(400);
    const res = await POST(new NextRequest('http://x/api/export', { method: 'POST', body: JSON.stringify({ ids: 'p1' }) }));
    expect(res.status).toBe(400);
  });
});
