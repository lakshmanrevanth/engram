// POST /api/problems/[id]/snooze { days } — push a due problem to a later day without rating it.

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getRequestTimeZone, dayRangeInTz } from '@/lib/dates';
import { SNOOZE_DAYS, snoozeTarget } from './snooze';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const { id } = await params;
    let days: number;
    try {
      days = Number((await request.json())?.days);
    } catch {
      days = NaN;
    }
    if (!SNOOZE_DAYS.includes(days)) {
      return Response.json({ error: `days must be one of: ${SNOOZE_DAYS.join(', ')}` }, { status: 400 });
    }

    const problem = await prisma.problem.findFirst({
      where: { id, userId },
      select: { id: true, status: true, nextRevisionAt: true },
    });
    if (!problem) return Response.json({ error: 'Problem not found' }, { status: 404 });
    if (problem.status !== 'ACTIVE' && problem.status !== 'MASTERED') {
      return Response.json({ error: 'Only problems in rotation can be snoozed.' }, { status: 400 });
    }

    const now = new Date();
    const tz = getRequestTimeZone(request);
    // Snoozing must never pull a later review earlier.
    if (problem.nextRevisionAt > dayRangeInTz(now, tz).end) {
      return Response.json({ error: 'This problem is not due yet.' }, { status: 409 });
    }

    const updated = await prisma.problem.update({
      where: { id },
      data: { nextRevisionAt: snoozeTarget(now, tz, days) },
    });
    return Response.json(updated);
  } catch (e) {
    console.error('[POST /api/problems/[id]/snooze]', e);
    return Response.json({ error: 'Failed to snooze problem' }, { status: 500 });
  }
}
