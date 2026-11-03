/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { prisma } from '@/lib/prisma';
import { sendReminderEmail } from '@/lib/reminder-mail';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn(), update: vi.fn() },
    problem: { count: vi.fn() },
  },
}));

vi.mock('@/lib/reminder-mail', () => ({
  sendReminderEmail: vi.fn().mockResolvedValue({ success: true }),
}));

function req(token?: string) {
  return new NextRequest('http://localhost/api/cron/reminders', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('GET /api/cron/reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'secret';
    vi.useFakeTimers();
    // 03:30 UTC = 09:00 in Asia/Kolkata
    vi.setSystemTime(new Date('2026-11-03T03:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects requests without the cron secret', async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('wrong'))).status).toBe(401);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('emails users whose local reminder hour is now and who have reviews due', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'a', email: 'a@x.com', name: 'A', timezone: 'Asia/Kolkata', reminderHour: 9 },
      { id: 'b', email: 'b@x.com', name: 'B', timezone: 'Asia/Kolkata', reminderHour: 10 },
      { id: 'c', email: 'c@x.com', name: 'C', timezone: null, reminderHour: 3 },
      { id: 'd', email: 'd@x.com', name: 'D', timezone: 'UTC', reminderHour: 3 },
    ] as any);
    vi.mocked(prisma.problem.count).mockImplementation((async (args: any) =>
      args.where.userId === 'd' ? 0 : 4) as any);

    const res = await GET(req('secret'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ checked: 4, eligible: 3, sent: 2, noneDue: 1, failed: 0 });
    expect(sendReminderEmail).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendReminderEmail).mock.calls.map((c) => c[0].email).sort()).toEqual(['a@x.com', 'c@x.com']);
    expect(prisma.user.update).toHaveBeenCalledTimes(2);

    // Only reminder-enabled users not reminded in the last 20 hours are loaded.
    const where = vi.mocked(prisma.user.findMany).mock.calls[0][0]!.where as any;
    expect(where.remindersEnabled).toBe(true);
  });

  it('does not mark lastReminderAt when sending fails', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'a', email: 'a@x.com', name: 'A', timezone: 'Asia/Kolkata', reminderHour: 9 },
    ] as any);
    vi.mocked(prisma.problem.count).mockResolvedValue(2 as any);
    vi.mocked(sendReminderEmail).mockResolvedValueOnce({ success: false, error: 'x' });

    const json = await (await GET(req('secret'))).json();
    expect(json.failed).toBe(1);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
