/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    problem: { findMany: vi.fn() },
    revision: { findMany: vi.fn(), count: vi.fn() },
  },
}));

const req = (tz = 'UTC') => new NextRequest('http://localhost/api/stats', { headers: { cookie: `tz=${tz}` } });

describe('GET /api/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      timezone: null,
      dailyGoal: 5,
      defaultPlatform: 'LEETCODE',
      ladderDays: [2, 5, 10, 20],
      remindersEnabled: false,
      reminderHour: 9,
      goalBasedStreak: false,
    } as any);
    vi.mocked(prisma.problem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.revision.findMany).mockResolvedValue([]);
    vi.mocked(prisma.revision.count).mockResolvedValue(0);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
    expect(prisma.problem.findMany).not.toHaveBeenCalled();
  });

  it('scopes every query to the user and limits revisions by date in SQL', async () => {
    const res = await GET(req('Asia/Kolkata'));
    expect(res.status).toBe(200);

    const pArgs = vi.mocked(prisma.problem.findMany).mock.calls[0][0] as any;
    expect(pArgs.where).toEqual({ userId: 'u1' });
    expect(pArgs.select).toEqual({ platform: true, status: true, currentStep: true, nextRevisionAt: true });

    const rArgs = vi.mocked(prisma.revision.findMany).mock.calls[0][0] as any;
    expect(rArgs.where.problem).toEqual({ userId: 'u1' });
    expect(rArgs.where.revisedAt.gte).toBeInstanceOf(Date);
    const ageDays = (Date.now() - rArgs.where.revisedAt.gte.getTime()) / 86400000;
    expect(ageDays).toBeGreaterThan(178);
    expect(ageDays).toBeLessThan(181);
    expect(rArgs.select.problem).toEqual({ select: { platform: true, topic: true } });

    expect(vi.mocked(prisma.revision.count).mock.calls[0][0]).toEqual({ where: { problem: { userId: 'u1' } } });
  });

  it('returns a full, empty payload for a new user', async () => {
    const body = await (await GET(req())).json();
    expect(body.timeZone).toBe('UTC');
    expect(body.ladderDays).toEqual([2, 5, 10, 20]);
    expect(body.totals.reviewsAllTime).toBe(0);
    expect(body.recallRate).toHaveLength(12);
    expect(body.upcoming).toHaveLength(30);
    expect(body.overallCleanRate).toBeNull();
    expect(body.weakestTopics).toEqual([]);
  });

  it('aggregates rows from the database', async () => {
    const now = Date.now();
    vi.mocked(prisma.problem.findMany).mockResolvedValue([
      { platform: 'LEETCODE', status: 'ACTIVE', currentStep: 1, nextRevisionAt: new Date(now - 2 * 86400000) },
      { platform: 'SYSTEM_DESIGN', status: 'MASTERED', currentStep: 3, nextRevisionAt: new Date(now + 40 * 86400000) },
    ] as any);
    vi.mocked(prisma.revision.findMany).mockResolvedValue([
      { revisedAt: new Date(now - 3600000), confidence: 'CLEAN', problem: { platform: 'LEETCODE', topic: 'Graphs' } },
      { revisedAt: new Date(now - 7200000), confidence: 'STRUGGLED', problem: { platform: 'LEETCODE', topic: 'Graphs' } },
      { revisedAt: new Date(now - 9000000), confidence: 'SHAKY', problem: { platform: 'LEETCODE', topic: 'Graphs' } },
    ] as any);
    vi.mocked(prisma.revision.count).mockResolvedValue(57);

    const body = await (await GET(req())).json();
    expect(body.totals).toMatchObject({ problems: 1, concepts: 1, active: 1, mastered: 1, reviewsAllTime: 57, reviewsLast30: 3 });
    expect(body.overdueCount).toBe(1);
    expect(body.ladder).toEqual({ steps: [0, 1, 0, 0], mastered: 1 });
    expect(body.weakestTopics[0]).toMatchObject({ topic: 'Graphs', reviews: 3, struggleRate: 0.5 });
  });

  it('returns 500 when the database fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(prisma.problem.findMany).mockRejectedValue(new Error('down'));
    expect((await GET(req())).status).toBe(500);
  });
});
