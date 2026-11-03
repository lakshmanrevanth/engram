// GET /api/daily/summary — everything the daily page needs in one request:
// due queue, today's ratings, streak + goal, counts, the user's ladder and the next review day.

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getRequestTimeZone, dayRangeInTz, dateKeyInTz, TZ_COOKIE } from '@/lib/dates';
import { getUserPreferences } from '@/lib/preferences';
import { getDueProblems } from '@/app/api/problems/due/query';
import { getRevisedToday } from '@/app/api/problems/revised-today/query';
import { getStreakSummary } from '@/app/api/streak/compute';

const IN_ROTATION = ['ACTIVE', 'MASTERED'] as ('ACTIVE' | 'MASTERED')[];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const prefs = await getUserPreferences(userId);
    // Cookie first (it follows the device); the saved timezone covers a missing cookie.
    const tz = request.cookies.get(TZ_COOKIE) ? getRequestTimeZone(request) : prefs.timezone ?? 'UTC';
    const now = new Date();
    const { start, end } = dayRangeInTz(now, tz);

    const [due, revisedToday, streak, total, mastered, next] = await Promise.all([
      getDueProblems(userId, start, end),
      getRevisedToday(userId, start, end),
      getStreakSummary(userId, tz, prefs, now),
      prisma.problem.count({ where: { userId } }),
      prisma.problem.count({ where: { userId, status: 'MASTERED' } }),
      prisma.problem.findFirst({
        where: { userId, status: { in: IN_ROTATION }, nextRevisionAt: { gt: end } },
        orderBy: { nextRevisionAt: 'asc' },
        select: { nextRevisionAt: true },
      }),
    ]);

    // The next local day with reviews, and how many fall on it.
    let upcoming: { date: string; count: number } | null = null;
    if (next) {
      const day = dayRangeInTz(next.nextRevisionAt, tz);
      const count = await prisma.problem.count({
        where: { userId, status: { in: IN_ROTATION }, nextRevisionAt: { gte: day.start, lte: day.end } },
      });
      upcoming = { date: dateKeyInTz(next.nextRevisionAt, tz), count: Math.max(1, count) };
    }

    return Response.json({
      today: dateKeyInTz(now, tz),
      due,
      revisedToday,
      streak,
      counts: { total, mastered },
      ladder: prefs.ladderDays,
      upcoming,
    });
  } catch (e) {
    console.error('[GET /api/daily/summary]', e);
    return Response.json({ error: 'Failed to load the daily summary' }, { status: 500 });
  }
}
