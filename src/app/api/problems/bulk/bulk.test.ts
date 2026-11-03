import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { statusUpdateData } from './status';

import { auth } from '@/auth';
import { getUserPreferences } from '@/lib/preferences';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/preferences', () => ({ getUserPreferences: vi.fn() }));

const tx = {
  problem: { count: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) },
}));

const req = (body: unknown) =>
  new NextRequest('http://localhost/api/problems/bulk', { method: 'POST', body: JSON.stringify(body) });

describe('POST /api/problems/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
    vi.mocked(getUserPreferences).mockResolvedValue({ ladderDays: [2, 5, 10, 20] } as any);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    expect((await POST(req({ ids: ['a'], action: 'delete' }))).status).toBe(401);
  });

  it('validates ids, action and value', async () => {
    expect((await POST(req({ ids: [], action: 'delete' }))).status).toBe(400);
    expect((await POST(req({ ids: ['a'], action: 'explode' }))).status).toBe(400);
    expect((await POST(req({ ids: ['a'], action: 'status', value: 'NOPE' }))).status).toBe(400);
    expect((await POST(req({ ids: ['a'], action: 'favorite', value: 'yes' }))).status).toBe(400);
  });

  it('rejects the whole batch when any id is not owned', async () => {
    tx.problem.count.mockResolvedValue(1);
    const res = await POST(req({ ids: ['a', 'b'], action: 'delete' }));
    expect(res.status).toBe(404);
    expect(tx.problem.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes owned problems scoped to the user', async () => {
    tx.problem.count.mockResolvedValue(2);
    tx.problem.deleteMany.mockResolvedValue({ count: 2 });
    const res = await POST(req({ ids: ['a', 'b', 'a'], action: 'delete' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ count: 2 });
    expect(tx.problem.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'b'] }, userId: 'u1' } });
  });

  it('ACTIVE resets the schedule with the user ladder', async () => {
    tx.problem.count.mockResolvedValue(1);
    tx.problem.updateMany.mockResolvedValue({ count: 1 });
    const before = Date.now();
    await POST(req({ ids: ['a'], action: 'status', value: 'active' }));
    const data = tx.problem.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe('ACTIVE');
    expect(data.currentStep).toBe(0);
    const days = (data.nextRevisionAt.getTime() - before) / 86_400_000;
    expect(Math.round(days)).toBe(2);
  });

  it('favorite sets isFavorite', async () => {
    tx.problem.count.mockResolvedValue(1);
    tx.problem.updateMany.mockResolvedValue({ count: 1 });
    await POST(req({ ids: ['a'], action: 'favorite', value: true }));
    expect(tx.problem.updateMany.mock.calls[0][0].data).toEqual({ isFavorite: true });
  });
});

describe('statusUpdateData', () => {
  const now = new Date('2026-11-03T10:00:00Z');
  it('MASTERED schedules the 90-day recheck at step 3', () => {
    const d = statusUpdateData('MASTERED', now) as any;
    expect(d.currentStep).toBe(3);
    expect(Math.round((d.nextRevisionAt.getTime() - now.getTime()) / 86_400_000)).toBe(90);
  });
  it('RETIRED only changes the status', () => {
    expect(statusUpdateData('RETIRED', now)).toEqual({ status: 'RETIRED' });
  });
});
