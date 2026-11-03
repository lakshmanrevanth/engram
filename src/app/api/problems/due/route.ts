// GET /api/problems/due — fetch today's due + overdue problems

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getRequestTimeZone, dayRangeInTz } from '@/lib/dates';
import { getDueProblems } from './query';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const beforeParam = request.nextUrl.searchParams.get('before');
    const { start: todayStart, end: tzEndOfToday } = dayRangeInTz(new Date(), getRequestTimeZone(request));

    // Prefer the client's explicit end-of-day if it sent one, else use its timezone cookie.
    let endOfToday = tzEndOfToday;
    if (beforeParam) {
      const parsed = new Date(beforeParam);
      if (!isNaN(parsed.getTime())) endOfToday = parsed;
    }

    return Response.json(await getDueProblems(userId, todayStart, endOfToday));
  } catch (e) {
    console.error('[GET /api/problems/due]', e);
    return Response.json({ error: 'Failed to fetch due problems' }, { status: 500 });
  }
}
