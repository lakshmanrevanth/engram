import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { snoozeTarget } from './snooze';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    problem: {
      findFirst: vi.fn(),
      update: vi.fn(async (args: any) => ({ id: 'p1', ...args.data })),
    },
  },
}));

const call = (body: unknown, tz = 'Asia/Kolkata') => {
  const req = new NextRequest('http://localhost/api/problems/p1/snooze', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { cookie: `tz=${encodeURIComponent(tz)}` },
  });
  return POST(req, { params: Promise.resolve({ id: 'p1' }) });
};

describe('snoozeTarget', () => {
  it('returns the start of the local day N days later', () => {
    // 23:30 in India on Nov 3 → tomorrow starts Nov 4 00:00 IST = Nov 3 18:30 UTC.
    const now = new Date('2026-11-03T18:00:00Z');
    expect(snoozeTarget(now, 'Asia/Kolkata', 1).toISOString()).toBe('2026-11-03T18:30:00.000Z');
    expect(snoozeTarget(now, 'Asia/Kolkata', 7).toISOString()).toBe('2026-11-09T18:30:00.000Z');
    expect(snoozeTarget(now, 'UTC', 3).toISOString()).toBe('2026-11-06T00:00:00.000Z');
  });
});

describe('POST /api/problems/[id]/snooze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    expect((await call({ days: 1 })).status).toBe(401);
  });

  it('rejects unsupported day counts', async () => {
    expect((await call({ days: 5 })).status).toBe(400);
    expect((await call({})).status).toBe(400);
    expect(prisma.problem.update).not.toHaveBeenCalled();
  });

  it('returns 404 for a problem the user does not own', async () => {
    vi.mocked(prisma.problem.findFirst).mockResolvedValue(null);
    expect((await call({ days: 1 })).status).toBe(404);
  });

  it('refuses retired problems', async () => {
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({ id: 'p1', status: 'RETIRED', nextRevisionAt: new Date() } as any);
    expect((await call({ days: 1 })).status).toBe(400);
  });

  it('refuses problems that are not due yet (never pulls a review earlier)', async () => {
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({
      id: 'p1',
      status: 'ACTIVE',
      nextRevisionAt: new Date(Date.now() + 5 * 86400000),
    } as any);
    expect((await call({ days: 1 })).status).toBe(409);
    expect(prisma.problem.update).not.toHaveBeenCalled();
  });

  it('moves a due problem to a later day without logging a revision', async () => {
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({
      id: 'p1',
      status: 'MASTERED',
      nextRevisionAt: new Date(Date.now() - 86400000),
    } as any);
    const res = await call({ days: 3 }, 'UTC');
    expect(res.status).toBe(200);
    const json = await res.json();
    const target = new Date(json.nextRevisionAt);
    expect(target.getUTCHours()).toBe(0);
    expect(target.getTime()).toBeGreaterThan(Date.now() + 2 * 86400000);
    expect(prisma.problem.update).toHaveBeenCalledTimes(1);
    const data = vi.mocked(prisma.problem.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(['nextRevisionAt']);
  });
});
