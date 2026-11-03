// POST /api/lists/[id]/problems — { problemIds, action: 'add' | 'remove' }
// Only the user's own list and own problems are touched; other ids are ignored.

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { parseIds } from '../../helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const action = body?.action;
    if (action !== 'add' && action !== 'remove') {
      return Response.json({ error: "action must be 'add' or 'remove'" }, { status: 400 });
    }
    const parsed = parseIds(body?.problemIds);
    if ('error' in parsed) return Response.json({ error: parsed.error.replace('ids', 'problemIds') }, { status: 400 });

    const list = await prisma.problemList.findFirst({ where: { id, userId }, select: { id: true } });
    if (!list) return Response.json({ error: 'List not found' }, { status: 404 });

    const owned = await prisma.problem.findMany({
      where: { id: { in: parsed.ids }, userId },
      select: { id: true },
    });
    if (owned.length === 0) return Response.json({ error: 'No matching problems' }, { status: 404 });

    const refs = owned.map((p) => ({ id: p.id }));
    const updated = await prisma.problemList.update({
      where: { id: list.id },
      data: { problems: action === 'add' ? { connect: refs } : { disconnect: refs } },
      select: { problems: { select: { id: true } } },
    });

    return Response.json({
      id: list.id,
      action,
      changed: owned.length,
      count: updated.problems.length,
      problemIds: updated.problems.map((p) => p.id),
    });
  } catch (e) {
    console.error('[POST /api/lists/[id]/problems]', e);
    return Response.json({ error: 'Failed to update list' }, { status: 500 });
  }
}
