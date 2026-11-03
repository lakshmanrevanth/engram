import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    problem: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
    revision: { findMany: vi.fn() },
    streakLog: { findMany: vi.fn() },
  },
}));

const DAY = 86400000;
const req = () => new NextRequest('http://localhost/api/daily/summary', { headers: { cookie: 'tz=UTC' } });

describe('GET /api/daily/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      timezone: null,
      dailyGoal: 2,
      defaultPlatform: 'LEETCODE',
      ladderDays: [2, 5, 10, 20],
      remindersEnabled: false,
      reminderHour: 9,
      goalBasedStreak: true,
    } as any);
    vi.mocked(prisma.streakLog.findMany).mockResolvedValue([]);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
  });

  it('combines due, revised today, streak, counts, ladder and the next review day', async () => {
    const now = Date.now();
    vi.mocked(prisma.problem.findMany).mockResolvedValue([
      { id: 'a', title: 'A', currentStep: 2, status: 'ACTIVE', nextRevisionAt: new Date(now), revisions: [] },
      {
        id: 'b',
        title: 'B',
        currentStep: 0,
        status: 'MASTERED',
        nextRevisionAt: new Date(now - 3 * DAY),
        revisions: [{ confidence: 'SHAKY', revisedAt: new Date(now - 10 * DAY) }],
      },
    ] as any);
    // Revision lookups: first call is revised-today, second is the streak history.
    vi.mocked(prisma.revision.findMany)
      .mockResolvedValueOnce([
        { id: 'r1', problemId: 'c', confidence: 'CLEAN', type: 'REGULAR', stepBefore: 0, stepAfter: 1, revisedAt: new Date(now), problem: { id: 'c', title: 'C' } },
      ] as any)
      .mockResolvedValueOnce([{ revisedAt: new Date(now) }, { revisedAt: new Date(now - DAY) }, { revisedAt: new Date(now - DAY) }] as any);
    vi.mocked(prisma.problem.count).mockResolvedValueOnce(10).mockResolvedValueOnce(3).mockResolvedValueOnce(4);
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({ nextRevisionAt: new Date(now + DAY) } as any);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.due.map((p: any) => p.id)).toEqual(['b', 'a']); // weakest first
    expect(json.due[0]).toMatchObject({ isRecheck: true, isOverdue: true, lastRating: 'SHAKY' });
    expect(json.due[0].revisions).toBeUndefined();
    expect(json.revisedToday[0]).toMatchObject({ id: 'c', latestRevision: { id: 'r1', confidence: 'CLEAN' } });
    expect(json.counts).toEqual({ total: 10, mastered: 3 });
    expect(json.ladder).toEqual([2, 5, 10, 20]);
    expect(json.streak).toMatchObject({ dailyGoal: 2, goalBasedStreak: true, todayReviewed: 1, goalMet: false });
    // Goal-based: yesterday (2 reviews) counts, today (1) not yet.
    expect(json.streak.currentStreak).toBe(1);
    expect(json.upcoming.count).toBe(4);
    expect(json.upcoming.date).toBe(new Date(now + DAY).toISOString().slice(0, 10));
  });

  it('returns upcoming: null when nothing else is scheduled', async () => {
    vi.mocked(prisma.problem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.revision.findMany).mockResolvedValue([]);
    vi.mocked(prisma.problem.count).mockResolvedValue(0);
    vi.mocked(prisma.problem.findFirst).mockResolvedValue(null);

    const json = await (await GET(req())).json();
    expect(json.upcoming).toBeNull();
    expect(json.due).toEqual([]);
  });
});
