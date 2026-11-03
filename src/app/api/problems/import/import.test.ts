import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/prisma', () => {
  const client: any = {
    userColumnConfig: { findMany: vi.fn(), create: vi.fn() },
    problemList: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    problem: { findMany: vi.fn(), createMany: vi.fn(), update: vi.fn() },
    revision: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    streakLog: { createMany: vi.fn() },
  };
  client.$transaction = vi.fn(async (cb: any) => cb(client));
  return { prisma: client };
});

const db = prisma as any;
const req = (body: unknown) =>
  new NextRequest('http://x/api/problems/import', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

const base = {
  platform: 'LEETCODE',
  title: 'Two Sum',
  url: 'https://leetcode.com/problems/two-sum/',
  difficulty: 'EASY',
  topic: 'Arrays',
  dateSolved: '2024-01-01T00:00:00.000Z',
  notes: null,
  currentStep: 2,
  nextRevisionAt: '2024-02-01T00:00:00.000Z',
  status: 'ACTIVE',
};

const existingRow = {
  id: 'e1', platform: 'LEETCODE', problemNumber: 1, title: 'Two Sum', url: '#', difficulty: 'EASY', topic: 'General',
  dateSolved: new Date('2024-01-05T00:00:00.000Z'), notes: null, code: null, tags: [], customFields: {}, isFavorite: false,
  status: 'ACTIVE', currentStep: 0, nextRevisionAt: new Date('2024-01-08T00:00:00.000Z'), revisionCount: 0,
};

describe('POST /api/problems/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
    db.userColumnConfig.findMany.mockResolvedValue([{ id: 'c1', name: 'Done', type: 'checkbox', options: null, order: 0 }]);
    db.userColumnConfig.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));
    db.problemList.findMany.mockResolvedValue([{ id: 'l1', name: 'blind 75' }]);
    db.problemList.create.mockImplementation(async ({ data }: any) => ({ id: `list-${data.name}` }));
    db.problem.createMany.mockImplementation(async ({ data }: any) => ({ count: data.length }));
    db.revision.findMany.mockResolvedValue([]);
    db.streakLog.createMany.mockResolvedValue({ count: 1 });
    // first findMany = existing, second = id lookup
    db.problem.findMany.mockResolvedValueOnce([existingRow]).mockResolvedValueOnce([
      { id: 'e1', platform: 'LEETCODE', problemNumber: 1 },
      { id: 'n2', platform: 'LEETCODE', problemNumber: 2 },
    ]);
  });

  it('validates input and limits', async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ problems: [] }))).status).toBe(400);
    expect((await POST(req({ problems: [{ ...base, problemNumber: 1, platform: 'X' }] }))).status).toBe(400);
    expect((await POST(req({ problems: [{ ...base, problemNumber: 1 }], duplicateStrategy: 'replace' }))).status).toBe(400);
    const many = Array.from({ length: 2001 }, (_, i) => ({ ...base, problemNumber: i + 1 }));
    expect((await POST(req({ problems: many }))).status).toBe(400);
  });

  it('drops values Postgres would reject instead of failing the whole import', async () => {
    expect((await POST(req({ problems: [{ ...base, problemNumber: 1, nextRevisionAt: '-200000-01-01T00:00:00Z' }] }))).status).toBe(400);
    const res = await POST(
      req({
        problems: [{ ...base, problemNumber: 2, revisionCount: 99999999999 }],
        streakLogs: [{ date: '2024-02-31', completed: true }, { date: '2024-13-45', completed: true }, { date: '2024-02-01', completed: true }],
      })
    );
    expect(res.status).toBe(201);
    expect(db.problem.createMany.mock.calls[0][0].data[0].revisionCount).toBe(0);
    const logs = db.streakLog.createMany.mock.calls[0][0].data;
    expect(logs).toHaveLength(1);
    expect(logs[0].date.toISOString()).toBe('2024-02-01T00:00:00.000Z');
  });

  it('skip: creates new problems with schedule, columns, lists, revisions and streaks; leaves existing alone', async () => {
    const res = await POST(
      req({
        problems: [
          { ...base, problemNumber: 1 },
          {
            ...base, problemNumber: 2, title: 'Add Two', tags: ['list'], lists: ['Blind 75', 'Mine'], isFavorite: true,
            customFields: { done: 'yes', Company: 'Google' }, revisionCount: 1,
            revisions: [{ revisedAt: '2024-01-04T00:00:00.000Z', confidence: 'CLEAN', type: 'REGULAR', stepBefore: 0, stepAfter: 1 }],
          },
          { ...base, problemNumber: 2, title: 'dupe in file' },
        ],
        columnDefs: [{ name: 'Company', type: 'select', options: ['Google'] }],
        streakLogs: [{ date: '2024-01-04', completed: true }],
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ imported: 1, updated: 0, skipped: 2, customColumnsCreated: ['Company'], listsCreated: ['Mine'], revisionsImported: 1, streakDaysImported: 1 });

    const created = db.problem.createMany.mock.calls[0][0].data[0];
    expect(created).toMatchObject({
      problemNumber: 2, currentStep: 2, status: 'ACTIVE', tags: ['list'], isFavorite: true, revisionCount: 1,
      customFields: { Done: 'true', Company: 'Google' },
    });
    expect(created.nextRevisionAt.toISOString()).toBe('2024-02-01T00:00:00.000Z');
    expect(db.problem.update).not.toHaveBeenCalled();
    expect(db.revision.createMany.mock.calls[0][0].data[0]).toMatchObject({ problemId: 'n2', confidence: 'CLEAN' });
    // existing list matched case-insensitively, new one created
    const listUpdates = db.problemList.update.mock.calls.map((c: any) => [c[0].where.id, c[0].data.problems.connect]);
    expect(listUpdates).toEqual([['l1', [{ id: 'n2' }]], ['list-Mine', [{ id: 'n2' }]]]);
  });

  it('merge: fills empty fields and keeps the more advanced schedule', async () => {
    const res = await POST(req({ problems: [{ ...base, problemNumber: 1, notes: 'n' }], duplicateStrategy: 'merge' }));
    const body = await res.json();
    expect(body.updated).toBe(1);
    const { where, data } = db.problem.update.mock.calls[0][0];
    expect(where).toEqual({ id: 'e1' });
    expect(data.url).toBe(base.url);
    expect(data.topic).toBe('Arrays');
    expect(data.notes).toBe('n');
    expect(data.currentStep).toBe(2);
    expect(data.dateSolved.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('overwrite: replaces revisions for backups', async () => {
    const res = await POST(
      req({
        problems: [{
          ...base, problemNumber: 1, title: 'Renamed',
          revisions: [{ revisedAt: '2024-01-04T00:00:00.000Z', confidence: 'SHAKY', type: 'REGULAR', stepBefore: 0, stepAfter: 0 }],
        }],
        duplicateStrategy: 'overwrite',
      })
    );
    expect((await res.json()).updated).toBe(1);
    expect(db.problem.update.mock.calls[0][0].data.title).toBe('Renamed');
    expect(db.revision.deleteMany).toHaveBeenCalledWith({ where: { problemId: { in: ['e1'] } } });
    expect(db.revision.createMany).toHaveBeenCalledTimes(1);
  });
});
