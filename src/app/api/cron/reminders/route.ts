// GET /api/cron/reminders — hourly job (see vercel.json) that emails users
// whose reminder hour has arrived in their timezone and who have reviews due.
// Protected by `Authorization: Bearer ${CRON_SECRET}`.

import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { dayRangeInTz, isValidTimeZone } from '@/lib/dates';
import { sendReminderEmail } from '@/lib/reminder-mail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PAGE_SIZE = 200;
const CONCURRENCY = 10;
const MIN_GAP_MS = 20 * 60 * 60 * 1000;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hourInTz(date: Date, tz: string): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(date)
    .find((p) => p.type === 'hour')?.value;
  return Number(h ?? 0) % 24;
}

type Candidate = { id: string; email: string; name: string | null; timezone: string | null; reminderHour: number };

async function processUser(user: Candidate, now: Date): Promise<'sent' | 'none-due' | 'failed'> {
  const tz = isValidTimeZone(user.timezone) ? user.timezone : 'UTC';
  const { end } = dayRangeInTz(now, tz);
  const dueWhere = { userId: user.id, status: { in: ['ACTIVE', 'MASTERED'] as ('ACTIVE' | 'MASTERED')[] }, nextRevisionAt: { lte: end } };
  const [dueCount, conceptCount] = await Promise.all([
    prisma.problem.count({ where: dueWhere }),
    prisma.problem.count({ where: { ...dueWhere, platform: 'SYSTEM_DESIGN' } }),
  ]);
  if (dueCount === 0) return 'none-due';

  const result = await sendReminderEmail({ email: user.email, name: user.name, dueCount, conceptCount });
  if (!result.success) return 'failed';
  await prisma.user.update({ where: { id: user.id }, data: { lastReminderAt: now } });
  return 'sent';
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const stats = { checked: 0, eligible: 0, sent: 0, noneDue: 0, failed: 0 };
  let cursor: string | undefined;

  try {
    for (;;) {
      const users: Candidate[] = await prisma.user.findMany({
        where: {
          remindersEnabled: true,
          OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: new Date(now.getTime() - MIN_GAP_MS) } }],
        },
        select: { id: true, email: true, name: true, timezone: true, reminderHour: true },
        orderBy: { id: 'asc' },
        take: PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (users.length === 0) break;
      cursor = users[users.length - 1].id;
      stats.checked += users.length;

      const due = users.filter((u) => {
        const tz = isValidTimeZone(u.timezone) ? u.timezone : 'UTC';
        return hourInTz(now, tz) === u.reminderHour;
      });
      stats.eligible += due.length;

      for (let i = 0; i < due.length; i += CONCURRENCY) {
        const results = await Promise.allSettled(due.slice(i, i + CONCURRENCY).map((u) => processUser(u, now)));
        for (const r of results) {
          if (r.status === 'rejected' || r.value === 'failed') stats.failed++;
          else if (r.value === 'sent') stats.sent++;
          else stats.noneDue++;
        }
      }

      if (users.length < PAGE_SIZE) break;
    }

    return Response.json({ ok: true, ...stats });
  } catch (e) {
    console.error('[GET /api/cron/reminders]', e instanceof Error ? e.message : 'unknown error');
    return Response.json({ error: 'Reminder job failed', ...stats }, { status: 500 });
  }
}
