/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH } from './route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

const prefRow = {
  timezone: 'Asia/Kolkata',
  dailyGoal: 8,
  defaultPlatform: 'CODEFORCES',
  ladderDays: [2, 5, 10, 20],
  remindersEnabled: true,
  reminderHour: 7,
  goalBasedStreak: true,
};

function patch(body: unknown) {
  return new NextRequest('http://localhost/api/settings', { method: 'PATCH', body: JSON.stringify(body) });
}

describe('/api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
  });

  it('GET returns 401 without a session', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('GET returns stored preferences', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: 'u1', name: 'A', email: 'a@x.com' } as any)
      .mockResolvedValueOnce(prefRow as any);
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.preferences).toEqual(prefRow);
  });

  it('PATCH trims and saves the name', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'u1', name: 'Bob', email: 'a@x.com', ...prefRow } as any);
    const res = await PATCH(patch({ name: '  Bob  ' }));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.user.update).mock.calls[0][0].data).toEqual({ name: 'Bob' });
  });

  it('PATCH rejects an empty or too long name', async () => {
    expect((await PATCH(patch({ name: '   ' }))).status).toBe(400);
    expect((await PATCH(patch({ name: 'x'.repeat(61) }))).status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('PATCH validates preference fields', async () => {
    const res = await PATCH(patch({ ladderDays: [7, 3, 14, 30] }));
    expect(res.status).toBe(400);
    expect((await PATCH(patch({ reminderHour: 24 }))).status).toBe(400);
    expect((await PATCH(patch({ timezone: 'Mars/Base' }))).status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('PATCH saves valid preferences', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'u1', name: 'A', email: 'a@x.com', ...prefRow } as any);
    const res = await PATCH(patch({ dailyGoal: 8, ladderDays: [2, 5, 10, 20], goalBasedStreak: true }));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.user.update).mock.calls[0][0].data).toEqual({
      dailyGoal: 8,
      ladderDays: [2, 5, 10, 20],
      goalBasedStreak: true,
    });
    const json = await res.json();
    expect(json.preferences.ladderDays).toEqual([2, 5, 10, 20]);
  });

  it('PATCH rejects an empty update', async () => {
    expect((await PATCH(patch({}))).status).toBe(400);
  });
});
