// PATCH  /api/lists/[id] — rename { name }
// DELETE /api/lists/[id] — delete the list (problems stay)

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isUniqueViolation, parseListName } from '../helpers';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = parseListName(body?.name);
    if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 });

    try {
      const result = await prisma.problemList.updateMany({ where: { id, userId }, data: { name: parsed.name } });
      if (result.count === 0) return Response.json({ error: 'List not found' }, { status: 404 });
    } catch (e) {
      if (isUniqueViolation(e)) return Response.json({ error: 'A list with that name already exists' }, { status: 409 });
      throw e;
    }
    return Response.json({ id, name: parsed.name });
  } catch (e) {
    console.error('[PATCH /api/lists/[id]]', e);
    return Response.json({ error: 'Failed to rename list' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;
    const { id } = await params;

    const result = await prisma.problemList.deleteMany({ where: { id, userId } });
    if (result.count === 0) return Response.json({ error: 'List not found' }, { status: 404 });
    return Response.json({ success: true });
  } catch (e) {
    console.error('[DELETE /api/lists/[id]]', e);
    return Response.json({ error: 'Failed to delete list' }, { status: 500 });
  }
}
