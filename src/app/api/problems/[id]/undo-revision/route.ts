// POST /api/problems/[id]/undo-revision — undo the most recent revision for a problem
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { revertRevision } from '@/lib/scheduling';
import type { RevisionType, Confidence, ProblemStatus } from '@/lib/scheduling';
import { getRequestTimeZone, dayRangeInTz, streakDateFor } from '@/lib/dates';
import { getUserPreferences } from '@/lib/preferences';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const { id } = await params;
    const problem = await prisma.problem.findFirst({
      where: { id, userId },
      include: {
        revisions: {
          orderBy: { revisedAt: 'desc' },
          take: 2,
        },
      },
    });

    if (!problem) return Response.json({ error: 'Problem not found' }, { status: 404 });
    if (problem.revisions.length === 0) {
      return Response.json({ error: 'No revisions found to undo for this problem' }, { status: 400 });
    }

    const latestRevision = problem.revisions[0];
    const priorRevision = problem.revisions[1] ?? null;

    const today = new Date();
    const tz = getRequestTimeZone(request);
    const { start: todayStart, end: todayEnd } = dayRangeInTz(today, tz);

    // Undo only reverses today's rating. Without this, a double click (toast + row,
    // or two tabs) would delete an older, legitimate revision.
    let expectedRevisionId: string | undefined;
    try {
      const body = await request.json();
      expectedRevisionId = typeof body?.revisionId === 'string' ? body.revisionId : undefined;
    } catch {
      // No body is fine — older clients don't send one.
    }
    if (expectedRevisionId && expectedRevisionId !== latestRevision.id) {
      return Response.json({ error: 'That rating was already undone.' }, { status: 409 });
    }
    if (latestRevision.revisedAt < todayStart) {
      return Response.json({ error: 'Only ratings made today can be undone.' }, { status: 409 });
    }

    const { ladderDays: ladder } = await getUserPreferences(userId);
    const { restoredStep, restoredStatus, restoredNextRevisionAt, restoredRevisionCount } = revertRevision({
      currentProblem: {
        createdAt: problem.createdAt,
        revisionCount: problem.revisionCount,
      },
      latestRevision: {
        stepBefore: latestRevision.stepBefore,
        type: latestRevision.type as RevisionType,
      },
      priorRevision: priorRevision
        ? {
            stepBefore: priorRevision.stepBefore,
            confidence: priorRevision.confidence as Confidence,
            type: priorRevision.type as RevisionType,
            revisedAt: priorRevision.revisedAt,
          }
        : null,
      ladder,
    });

    const updatedProblem = await prisma.$transaction(async (tx) => {
      // 1. Delete the latest revision record
      await tx.revision.delete({
        where: { id: latestRevision.id },
      });

      // 2. Restore problem state
      return tx.problem.update({
        where: { id },
        data: {
          currentStep: restoredStep,
          status: restoredStatus as ProblemStatus,
          nextRevisionAt: restoredNextRevisionAt,
          revisionCount: restoredRevisionCount,
        },
      });
    });

    // 3. Streak check: If the undone revision was created today, check if any other revisions were made today
    if (latestRevision.revisedAt >= todayStart && latestRevision.revisedAt <= todayEnd) {
      const remainingRevisionsToday = await prisma.revision.count({
        where: {
          problem: { userId },
          revisedAt: { gte: todayStart, lte: todayEnd },
        },
      });

      if (remainingRevisionsToday === 0) {
        const todayDateObj = streakDateFor(today, tz);
        await prisma.streakLog.upsert({
          where: { userId_date: { userId, date: todayDateObj } },
          create: { userId, date: todayDateObj, completed: false },
          update: { completed: false },
        });
      }
    }

    return Response.json({ success: true, problem: updatedProblem });
  } catch (e) {
    console.error('[POST /api/problems/[id]/undo-revision]', e);
    return Response.json({ error: 'Failed to undo revision' }, { status: 500 });
  }
}
