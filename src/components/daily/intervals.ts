import { applyRevision, type Confidence } from '@/lib/scheduling';

export type { Confidence };
export const CONFIDENCES: Confidence[] = ['CLEAN', 'SHAKY', 'STRUGGLED'];

/**
 * How long until this problem comes back for each rating, e.g. "7d" or "mastered".
 * Uses the server's scheduling rules and the user's ladder, so the label matches what happens.
 */
export function nextIntervalLabel(
  problem: { status?: string; currentStep?: number | null },
  conf: Confidence,
  ladder?: readonly number[] | null,
  today: Date = new Date()
): string {
  const isRecheck = problem.status === 'MASTERED';
  const result = applyRevision({
    currentStep: problem.currentStep ?? 0,
    status: isRecheck ? 'MASTERED' : 'ACTIVE',
    confidence: conf,
    revisionType: isRecheck ? 'RECHECK' : 'REGULAR',
    today,
    ladder: ladder ?? undefined,
  });
  if (result.newStatus === 'MASTERED') return 'mastered';
  if (!result.nextRevisionAt) return '';
  const days = Math.round((result.nextRevisionAt.getTime() - today.getTime()) / 86400000);
  return `${days}d`;
}

/** "back in 7 days" / "marks it mastered" for titles and focus-mode cards. */
export function describeInterval(label: string): string {
  if (label === 'mastered') return 'marks it mastered';
  const n = parseInt(label, 10);
  if (!Number.isFinite(n)) return '';
  return n === 1 ? 'back tomorrow' : `back in ${n} days`;
}
