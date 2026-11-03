import { addDays, getInitialSchedule, MASTERY_RECHECK_DAYS } from '@/lib/scheduling';

export const BULK_STATUSES = ['ACTIVE', 'MASTERED', 'RETIRED'] as const;
export type BulkStatus = (typeof BULK_STATUSES)[number];

/** Same schedule rules as PATCH /api/problems/[id] when the status changes. */
export function statusUpdateData(status: BulkStatus, now: Date, ladder?: readonly number[]) {
  if (status === 'ACTIVE') {
    const initial = getInitialSchedule(now, ladder);
    return { status, currentStep: initial.currentStep, nextRevisionAt: initial.nextRevisionAt };
  }
  if (status === 'MASTERED') {
    return { status, currentStep: 3, nextRevisionAt: addDays(now, MASTERY_RECHECK_DAYS) };
  }
  return { status };
}
