// GET /api/problems/revised-today — fetch problems revised today by the current user
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getRequestTimeZone, dayRangeInTz } from '@/lib/dates';
import { getRevisedToday } from './query';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // The user's local day, from their timezone cookie (the server runs in UTC).
    const { start, end } = dayRangeInTz(new Date(), getRequestTimeZone(request));
    return Response.json(await getRevisedToday(session.user.id, start, end));
  } catch (e) {
    console.error('[GET /api/problems/revised-today]', e);
    return Response.json({ error: 'Failed to fetch revised problems' }, { status: 500 });
  }
}
