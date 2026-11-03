// Today's due + overdue problems, shared by /api/problems/due and /api/daily/summary.

import { prisma } from '@/lib/prisma';

const DAY = 24 * 60 * 60 * 1000;

export async function getDueProblems(userId: string, todayStart: Date, endOfToday: Date) {
  // ACTIVE problems on the ladder, plus MASTERED problems due for their long-term recheck.
  const problems = await prisma.problem.findMany({
    where: {
      userId,
      status: { in: ['ACTIVE', 'MASTERED'] },
      nextRevisionAt: { lte: endOfToday },
    },
    orderBy: { nextRevisionAt: 'asc' },
    include: {
      revisions: { orderBy: { revisedAt: 'desc' }, take: 1, select: { confidence: true, revisedAt: true } },
    },
  });

  const result = problems.map(({ revisions, ...p }) => {
    const daysOverdue = p.nextRevisionAt < todayStart
      ? Math.ceil((todayStart.getTime() - p.nextRevisionAt.getTime()) / DAY)
      : 0;
    const last = revisions?.[0];
    return {
      ...p,
      isOverdue: daysOverdue > 0,
      daysOverdue,
      isRecheck: p.status === 'MASTERED',
      lastRating: last?.confidence ?? null,
      lastRevisedAt: last?.revisedAt ?? null,
    };
  });

  // Weakest memories first: lowest ladder step, then most overdue.
  result.sort((a, b) => a.currentStep - b.currentStep || b.daysOverdue - a.daysOverdue);
  return result;
}
