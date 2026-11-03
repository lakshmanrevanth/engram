// GET /api/stats — progress analytics for the Stats page: totals, weekly recall rate,
// weakest topics, the next 30 days of review load, and where items sit on the ladder.
// Loads only narrow columns; revisions are limited in SQL to the window the stats need.

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getRequestTimeZone, dateKeyInTz, startOfDayKeyInTz, TZ_COOKIE } from '@/lib/dates';
import { getUserPreferences } from '@/lib/preferences';
import { computeStats, revisionWindowStartKey } from './compute';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const prefs = await getUserPreferences(userId);
    // Cookie first (it follows the device); the saved timezone covers a missing cookie.
    const tz = request.cookies.get(TZ_COOKIE) ? getRequestTimeZone(request) : prefs.timezone ?? 'UTC';
    const now = new Date();
    const since = startOfDayKeyInTz(revisionWindowStartKey(dateKeyInTz(now, tz)), tz);

    const [problems, revisions, reviewsAllTime] = await Promise.all([
      prisma.problem.findMany({
        where: { userId },
        select: { platform: true, status: true, currentStep: true, nextRevisionAt: true },
      }),
      prisma.revision.findMany({
        where: { problem: { userId }, revisedAt: { gte: since } },
        select: { revisedAt: true, confidence: true, problem: { select: { platform: true, topic: true } } },
      }),
      prisma.revision.count({ where: { problem: { userId } } }),
    ]);

    const stats = computeStats({ now, timeZone: tz, ladderDays: prefs.ladderDays, problems, revisions, reviewsAllTime });
    return Response.json(stats, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('[GET /api/stats]', e);
    return Response.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
