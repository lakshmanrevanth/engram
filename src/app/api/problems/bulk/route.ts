// POST /api/problems/bulk — { ids, action: 'status' | 'delete' | 'favorite', value }
// All-or-nothing: every id must belong to the user, checked inside one transaction.

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserPreferences } from '@/lib/preferences';
import { parseIds } from '@/app/api/lists/helpers';
import { BULK_STATUSES, statusUpdateData, type BulkStatus } from './status';

class NotOwnedError extends Error {}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const body = await request.json().catch(() => ({}));
    const parsed = parseIds(body?.ids);
    if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 });
    const { ids } = parsed;
    const action = body?.action;

    let data: Record<string, unknown> | null = null;
    if (action === 'status') {
      const s = String(body?.value ?? '').toUpperCase();
      if (!(BULK_STATUSES as readonly string[]).includes(s)) {
        return Response.json({ error: 'value must be ACTIVE, MASTERED or RETIRED' }, { status: 400 });
      }
      const ladder = s === 'ACTIVE' ? (await getUserPreferences(userId)).ladderDays : undefined;
      data = statusUpdateData(s as BulkStatus, new Date(), ladder);
    } else if (action === 'favorite') {
      if (typeof body?.value !== 'boolean') return Response.json({ error: 'value must be a boolean' }, { status: 400 });
      data = { isFavorite: body.value };
    } else if (action !== 'delete') {
      return Response.json({ error: "action must be 'status', 'delete' or 'favorite'" }, { status: 400 });
    }

    const where = { id: { in: ids }, userId };
    try {
      const count = await prisma.$transaction(async (tx) => {
        const owned = await tx.problem.count({ where });
        if (owned !== ids.length) throw new NotOwnedError();
        const res = data ? await tx.problem.updateMany({ where, data }) : await tx.problem.deleteMany({ where });
        return res.count;
      });
      return Response.json({ success: true, action, count });
    } catch (e) {
      if (e instanceof NotOwnedError) return Response.json({ error: 'Some problems were not found' }, { status: 404 });
      throw e;
    }
  } catch (e) {
    console.error('[POST /api/problems/bulk]', e);
    return Response.json({ error: 'Bulk update failed' }, { status: 500 });
  }
}
