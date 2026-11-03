// GET /api/activity — revision activity for the last 365 days, grouped by the user's local day

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getRequestTimeZone, dateKeyInTz } from '@/lib/dates';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;
    const tz = getRequestTimeZone(request);

    const since = new Date();
    since.setDate(since.getDate() - 366);

    const revisions = await prisma.revision.findMany({
      where: { problem: { userId }, revisedAt: { gte: since } },
      select: { revisedAt: true },
    });

    const counts: Record<string, number> = {};
    for (const r of revisions) {
      const date = dateKeyInTz(r.revisedAt, tz);
      counts[date] = (counts[date] ?? 0) + 1;
    }

    const result = Object.entries(counts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return Response.json(result);
  } catch (e) {
    console.error('[GET /api/activity]', e);
    return Response.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
