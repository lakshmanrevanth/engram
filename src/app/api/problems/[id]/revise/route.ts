// PATCH /api/problems/[id]/revise — submit a revision for a problem

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { applyRevision } from '@/lib/scheduling';
import type { Confidence } from '@/lib/scheduling';
import { getRequestTimeZone, dayRangeInTz, streakDateFor } from '@/lib/dates';
import { getUserPreferences } from '@/lib/preferences';

class ConcurrentRevisionError extends Error {}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const { id } = await params;
    const body = await request.json();
    const { confidence, replaceLatest } = body as { confidence: Confidence; replaceLatest?: boolean };

    if (!confidence || !['CLEAN', 'SHAKY', 'STRUGGLED'].includes(confidence)) {
      return Response.json({ error: 'confidence must be one of: CLEAN, SHAKY, STRUGGLED' }, { status: 400 });
    }

    const problem = await prisma.problem.findFirst({
      where: { id, userId },
      select: {
        id: true,
        currentStep: true,
        status: true,
        nextRevisionAt: true,
        updatedAt: true,
        revisions: {
          orderBy: { revisedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            type: true,
            stepBefore: true,
            revisedAt: true,
          },
        },
      },
    });
    if (!problem) return Response.json({ error: 'Problem not found' }, { status: 404 });

    const { ladderDays: ladder } = await getUserPreferences(userId);

    const today = new Date();
    const tz = getRequestTimeZone(request);
    const { start: todayStart } = dayRangeInTz(today, tz);
    const latest = problem.revisions[0];
    const latestIsToday = !!latest && latest.revisedAt >= todayStart;

    // Changing a rating is only allowed for a rating made today.
    if (replaceLatest && !latestIsToday) {
      return Response.json({ error: 'You can only change a rating made today.' }, { status: 409 });
    }

    // A second plain rating on the same day (e.g. from a stale tab) would move the
    // problem up the ladder twice. Ask the client to change the existing rating instead.
    if (!replaceLatest && latestIsToday) {
      return Response.json(
        { error: 'Already reviewed today. Change the rating from Completed today instead.', code: 'ALREADY_REVISED_TODAY' },
        { status: 409 }
      );
    }

    if (problem.status === 'RETIRED') {
      return Response.json({ error: 'Retired problems cannot be reviewed.' }, { status: 400 });
    }

    // If replacing / changing the latest revision (e.g. from Clean to Struggled)
    if (replaceLatest && latest) {
      const latestRev = latest;
      const revisionType = latestRev.type;
      const { newStep, newStatus, nextRevisionAt } = applyRevision({
        currentStep: latestRev.stepBefore,
        status: (revisionType === 'RECHECK' ? 'MASTERED' : 'ACTIVE') as any,
        confidence,
        revisionType: revisionType as any,
        today: latestRev.revisedAt,
        ladder,
      });

      const updatedProblem = await prisma.$transaction(async (tx) => {
        await tx.revision.update({
          where: { id: latestRev.id },
          data: {
            confidence: confidence as any,
            stepAfter: newStep,
          },
        });
        return tx.problem.update({
          where: { id },
          data: {
            currentStep: newStep,
            status: newStatus as any,
            nextRevisionAt: nextRevisionAt ?? problem.nextRevisionAt,
          },
        });
      });

      return Response.json({ ...updatedProblem, revisionId: latestRev.id });
    }

    const revisionType = problem.status === 'MASTERED' ? 'RECHECK' : 'REGULAR';

    const { newStep, newStatus, nextRevisionAt } = applyRevision({
      currentStep: problem.currentStep,
      status: problem.status as any,
      confidence,
      revisionType,
      today,
      ladder,
    });

    // Optimistic lock: only apply if the problem is unchanged since we read it. Two
    // ratings sent at the same moment both pass the "already reviewed today" check
    // above; this makes the second one fail instead of moving the problem twice.
    let result: { updatedProblem: Record<string, unknown> | null; revisionId: string | null };
    try {
      result = await prisma.$transaction(async (tx) => {
        const { count } = await tx.problem.updateMany({
          where: { id, updatedAt: problem.updatedAt },
          data: {
            currentStep: newStep,
            status: newStatus as any,
            nextRevisionAt: nextRevisionAt ?? problem.nextRevisionAt,
            revisionCount: { increment: 1 },
          },
        });
        if (count === 0) throw new ConcurrentRevisionError();
        const revision = await tx.revision.create({
          data: {
            problemId: id,
            confidence: confidence as any,
            type: revisionType as any,
            stepBefore: problem.currentStep,
            stepAfter: newStep,
          },
        });
        const updatedProblem = await tx.problem.findUnique({ where: { id } });
        return { updatedProblem, revisionId: revision?.id ?? null };
      });
    } catch (e) {
      if (e instanceof ConcurrentRevisionError) {
        return Response.json(
          { error: 'Already reviewed today. Change the rating from Completed today instead.', code: 'ALREADY_REVISED_TODAY' },
          { status: 409 }
        );
      }
      throw e;
    }
    const { updatedProblem, revisionId } = result;

    // Mark today's streak complete (the user's local day, not the server's)
    const todayDateObj = streakDateFor(today, tz);

    await prisma.streakLog.upsert({
      where: { userId_date: { userId, date: todayDateObj } },
      create: { userId, date: todayDateObj, completed: true },
      update: { completed: true },
    });

    // revisionId lets the client undo exactly this rating.
    return Response.json({ ...updatedProblem, revisionId });
  } catch (e) {
    console.error('[PATCH /api/problems/[id]/revise]', e);
    return Response.json({ error: 'Failed to submit revision' }, { status: 500 });
  }
}
