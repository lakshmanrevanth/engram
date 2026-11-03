// PATCH  /api/columns/[id] — { name?, type?, options?, order? }; rename also moves the key in every problem's customFields
// DELETE /api/columns/[id] — deletes the column and its values on every problem

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { deleteColumn, updateColumn } from '../shared';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }
    return await updateColumn(session.user.id, id, body);
  } catch (e) {
    console.error('[PATCH /api/columns/[id]]', e);
    return Response.json({ error: 'Failed to update column' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    return await deleteColumn(session.user.id, id);
  } catch (e) {
    console.error('[DELETE /api/columns/[id]]', e);
    return Response.json({ error: 'Failed to delete column' }, { status: 500 });
  }
}
