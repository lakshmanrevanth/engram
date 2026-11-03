import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { PATCH } from './[id]/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getUserPreferences } from '@/lib/preferences';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/preferences', () => ({ getUserPreferences: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    problem: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

const DAY = 24 * 60 * 60 * 1000;

function post(body: unknown) {
  return POST(new NextRequest('http://localhost/api/problems', { method: 'POST', body: JSON.stringify(body) }));
}
function patch(body: unknown) {
  return PATCH(
    new NextRequest('http://localhost/api/problems/p1', { method: 'PATCH', body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: 'p1' }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
  vi.mocked(getUserPreferences).mockResolvedValue({ ladderDays: [2, 5, 10, 20] } as any);
  vi.mocked(prisma.problem.create).mockImplementation((async (args: any) => ({ id: 'new', ...args.data })) as any);
});

describe('POST /api/problems', () => {
  it('keeps client edits over looked-up values and stores tags', async () => {
    const res = await post({
      platform: 'LEETCODE', problemNumber: 1, difficulty: 'HARD', topic: 'Hashing', tags: [' Blind 75 ', 'blind 75'],
    });
    expect(res.status).toBe(201);
    const data = vi.mocked(prisma.problem.create).mock.calls[0][0].data as any;
    expect(data.title).toBe('Two Sum');
    expect(data.difficulty).toBe('HARD');
    expect(data.topic).toBe('Hashing');
    expect(data.tags).toEqual(['Blind 75']);
    expect(data.problemNumber).toBe(1);
  });

  it('schedules the first review from the solve date with the user ladder', async () => {
    const solved = new Date(Date.now() - 1 * DAY);
    await post({ platform: 'LEETCODE', problemNumber: 1, dateSolved: solved.toISOString() });
    const data = vi.mocked(prisma.problem.create).mock.calls[0][0].data as any;
    expect(data.dateSolved.toISOString()).toBe(solved.toISOString());
    expect(data.nextRevisionAt.getTime()).toBe(solved.getTime() + 2 * DAY);
  });

  it('makes an old solve due today instead of in the past', async () => {
    const before = Date.now();
    await post({ platform: 'LEETCODE', problemNumber: 1, dateSolved: new Date(before - 30 * DAY).toISOString() });
    const data = vi.mocked(prisma.problem.create).mock.calls[0][0].data as any;
    expect(data.nextRevisionAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(data.nextRevisionAt.getTime()).toBeLessThan(before + 60_000);
  });

  it('rejects future solve dates', async () => {
    const res = await post({ platform: 'LEETCODE', problemNumber: 1, dateSolved: new Date(Date.now() + 3 * DAY).toISOString() });
    expect(res.status).toBe(400);
    expect(prisma.problem.create).not.toHaveBeenCalled();
  });

  it('stores the Codeforces code', async () => {
    await post({ platform: 'CODEFORCES', code: '4A', problemNumber: 0 });
    const data = vi.mocked(prisma.problem.create).mock.calls[0][0].data as any;
    expect(data.code).toBe('4A');
    expect(data.problemNumber).toBe(401);
  });

  it('accepts a manual entry and gives it a non-zero number', async () => {
    const res = await post({
      platform: 'HACKERRANK', problemNumber: 0, title: 'Custom', difficulty: 'easy', url: 'https://www.hackerrank.com/challenges/my-custom-thing',
    });
    expect(res.status).toBe(201);
    const data = vi.mocked(prisma.problem.create).mock.calls[0][0].data as any;
    expect(data.title).toBe('Custom');
    expect(data.difficulty).toBe('EASY');
    expect(data.problemNumber).toBeGreaterThan(0);
  });

  it('rejects non-http URLs', async () => {
    const res = await post({ platform: 'GFG', title: 'x', difficulty: 'EASY', url: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });

  it('returns 422 when nothing resolves and no manual details are given', async () => {
    const res = await post({ platform: 'GFG', problemNumber: 0 });
    expect(res.status).toBe(422);
  });

  it('returns 409 with the existing id for duplicates', async () => {
    vi.mocked(prisma.problem.create).mockRejectedValue({ code: 'P2002' });
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({ id: 'existing', title: 'Two Sum' } as any);
    const res = await post({ platform: 'LEETCODE', problemNumber: 1 });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ existingId: 'existing' });
  });
});

describe('PATCH /api/problems/[id]', () => {
  const existing = { id: 'p1', platform: 'LEETCODE', problemNumber: 1, revisionCount: 0, status: 'ACTIVE' };

  beforeEach(() => {
    vi.mocked(prisma.problem.update).mockImplementation((async (args: any) => ({ id: 'p1', ...args.data })) as any);
  });

  it('keeps the single-query path for simple fields', async () => {
    vi.mocked(prisma.problem.updateMany).mockResolvedValue({ count: 1 });
    const res = await patch({ notes: 'hi' });
    expect(res.status).toBe(200);
    expect(prisma.problem.findFirst).not.toHaveBeenCalled();
  });

  it('returns 404 for problems the user does not own', async () => {
    vi.mocked(prisma.problem.findFirst).mockResolvedValue(null);
    const res = await patch({ title: 'New' });
    expect(res.status).toBe(404);
  });

  it('validates title, url and tags', async () => {
    expect((await patch({ title: '  ' })).status).toBe(400);
    expect((await patch({ url: 'ftp://x' })).status).toBe(400);
    expect((await patch({ tags: Array(11).fill('a').map((a, i) => a + i) })).status).toBe(400);
    expect((await patch({ dateSolved: new Date(Date.now() + 5 * DAY).toISOString() })).status).toBe(400);
  });

  it('recomputes the schedule when dateSolved changes and there are no revisions', async () => {
    vi.mocked(prisma.problem.findFirst).mockResolvedValue(existing as any);
    const solved = new Date(Date.now() - DAY);
    const res = await patch({ dateSolved: solved.toISOString(), title: 'Renamed', tags: ['dp'] });
    expect(res.status).toBe(200);
    const data = vi.mocked(prisma.problem.update).mock.calls[0][0].data as any;
    expect(data.title).toBe('Renamed');
    expect(data.tags).toEqual(['dp']);
    expect(data.nextRevisionAt.getTime()).toBe(solved.getTime() + 2 * DAY);
  });

  it('leaves the schedule alone once the problem has revisions', async () => {
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({ ...existing, revisionCount: 2 } as any);
    await patch({ dateSolved: new Date(Date.now() - DAY).toISOString() });
    const data = vi.mocked(prisma.problem.update).mock.calls[0][0].data as any;
    expect(data.dateSolved).toBeInstanceOf(Date);
    expect(data.nextRevisionAt).toBeUndefined();
  });

  it('returns 409 when the new number is already tracked', async () => {
    vi.mocked(prisma.problem.findFirst)
      .mockResolvedValueOnce(existing as any)
      .mockResolvedValueOnce({ id: 'other' } as any);
    const res = await patch({ problemNumber: 2 });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ existingId: 'other' });
    expect(prisma.problem.update).not.toHaveBeenCalled();
  });

  it('derives the Codeforces number from a new code', async () => {
    vi.mocked(prisma.problem.findFirst)
      .mockResolvedValueOnce({ ...existing, platform: 'CODEFORCES', problemNumber: 401 } as any)
      .mockResolvedValueOnce(null);
    await patch({ code: '158a' });
    const data = vi.mocked(prisma.problem.update).mock.calls[0][0].data as any;
    expect(data.code).toBe('158A');
    expect(data.problemNumber).toBe(15801);
  });

  it('still resets the schedule when status changes', async () => {
    vi.mocked(prisma.problem.updateMany).mockResolvedValue({ count: 1 });
    await patch({ status: 'ACTIVE' });
    const data = vi.mocked(prisma.problem.updateMany).mock.calls[0][0].data as any;
    expect(data.currentStep).toBe(0);
    expect(data.nextRevisionAt).toBeInstanceOf(Date);
  });
});

describe('PATCH /api/problems/[id] nextRevisionOn', () => {
  // No tz cookie in these requests, so the server uses UTC days.
  const utcKey = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
  const existing = (status: string) =>
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({ id: 'p1', platform: 'LEETCODE', problemNumber: 1, revisionCount: 2, status } as any);

  it('moves the next review to the start of the chosen day', async () => {
    existing('ACTIVE');
    vi.mocked(prisma.problem.update).mockImplementation((async (args: any) => ({ id: 'p1', ...args.data })) as any);
    const key = utcKey(10);
    const res = await patch({ nextRevisionOn: key });
    expect(res.status).toBe(200);
    const data = vi.mocked(prisma.problem.update).mock.calls[0][0].data as any;
    expect(data.nextRevisionAt.toISOString()).toBe(`${key}T00:00:00.000Z`);
    expect(data.currentStep).toBeUndefined(); // the ladder step is kept
  });

  it('allows a mastered problem to get an earlier recheck', async () => {
    existing('MASTERED');
    vi.mocked(prisma.problem.update).mockImplementation((async (args: any) => ({ id: 'p1', ...args.data })) as any);
    expect((await patch({ nextRevisionOn: utcKey(1) })).status).toBe(200);
  });

  it('rejects past dates, bad formats and retired problems', async () => {
    existing('ACTIVE');
    expect((await patch({ nextRevisionOn: utcKey(-2) })).status).toBe(400);
    expect((await patch({ nextRevisionOn: 'next week' })).status).toBe(400);
    expect((await patch({ nextRevisionOn: utcKey(5000) })).status).toBe(400);
    existing('RETIRED');
    expect((await patch({ nextRevisionOn: utcKey(3) })).status).toBe(400);
    expect(prisma.problem.update).not.toHaveBeenCalled();
  });
});
