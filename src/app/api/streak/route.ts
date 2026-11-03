// GET /api/streak — current streak, best streak and today's progress for the logged-in user

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getRequestTimeZone } from '@/lib/dates';
import { getUserPreferences } from '@/lib/preferences';
import { getStreakSummary } from './compute';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const prefs = await getUserPreferences(userId);
    const summary = await getStreakSummary(userId, getRequestTimeZone(request), prefs);
    return Response.json(summary);
  } catch (e) {
    console.error('[GET /api/streak]', e);
    return Response.json({ error: 'Failed to fetch streak' }, { status: 500 });
  }
}
