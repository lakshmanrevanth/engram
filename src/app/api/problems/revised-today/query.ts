// Problems rated today (latest rating each), shared by /api/problems/revised-today and /api/daily/summary.

import { prisma } from '@/lib/prisma';

export type RevisedTodayItem = Record<string, unknown> & {
  id: string;
  latestRevision: {
    id: string;
    confidence: string;
    type: string;
    stepBefore: number;
    stepAfter: number;
    revisedAt: Date;
  };
};

export async function getRevisedToday(userId: string, todayStart: Date, endOfToday: Date): Promise<RevisedTodayItem[]> {
  const revisions = await prisma.revision.findMany({
    where: {
      problem: { userId },
      revisedAt: { gte: todayStart, lte: endOfToday },
    },
    include: { problem: true },
    orderBy: { revisedAt: 'desc' },
  });

  // Keep only the latest revision of each problem.
  const problemMap = new Map<string, RevisedTodayItem>();
  for (const rev of revisions) {
    if (!problemMap.has(rev.problemId)) {
      problemMap.set(rev.problemId, {
        ...rev.problem,
        latestRevision: {
          id: rev.id,
          confidence: rev.confidence,
          type: rev.type,
          stepBefore: rev.stepBefore,
          stepAfter: rev.stepAfter,
          revisedAt: rev.revisedAt,
        },
      });
    }
  }
  return Array.from(problemMap.values());
}
