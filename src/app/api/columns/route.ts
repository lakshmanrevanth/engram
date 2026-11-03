// GET    /api/columns          — list custom columns (ordered)
// POST   /api/columns          — create { name, type?, options?, order? }
// DELETE /api/columns?id=...   — legacy alias of DELETE /api/columns/[id]

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  MAX_COLUMNS,
  isColumnType,
  normalizeOptions,
  toCustomColumn,
  validateColumnName,
} from '@/lib/custom-columns';
import { deleteColumn } from './shared';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const columns = await prisma.userColumnConfig.findMany({
      where: { userId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return Response.json(columns.map(toCustomColumn), {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (e) {
    console.error('[GET /api/columns]', e);
    return Response.json({ error: 'Failed to fetch columns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const type = body.type ?? 'text';
    if (!isColumnType(type)) {
      return Response.json({ error: 'Type must be one of text, select, date, checkbox, url' }, { status: 400 });
    }
    const opts = normalizeOptions(body.options);
    if (!opts.ok) return Response.json({ error: opts.error }, { status: 400 });

    const existing = await prisma.userColumnConfig.findMany({
      where: { userId },
      select: { id: true, name: true, order: true },
    });
    if (existing.length >= MAX_COLUMNS) {
      return Response.json({ error: `You can have at most ${MAX_COLUMNS} custom columns` }, { status: 400 });
    }
    const name = validateColumnName(body.name, existing);
    if (!name.ok) {
      const status = name.error.includes('already exists') ? 409 : 400;
      return Response.json({ error: name.error }, { status });
    }

    const nextOrder = existing.reduce((max, c) => Math.max(max, c.order + 1), 0);
    const column = await prisma.userColumnConfig.create({
      data: {
        userId,
        name: name.value,
        type,
        options: type === 'select' ? opts.value : undefined,
        order: Number.isInteger(body.order) && body.order >= 0 && body.order <= 10_000 ? body.order : nextOrder,
      },
    });
    return Response.json(toCustomColumn(column), { status: 201 });
  } catch (e) {
    console.error('[POST /api/columns]', e);
    return Response.json({ error: 'Failed to create column' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return Response.json({ error: 'Column id is required' }, { status: 400 });
    return deleteColumn(session.user.id, id);
  } catch (e) {
    console.error('[DELETE /api/columns]', e);
    return Response.json({ error: 'Failed to delete column' }, { status: 500 });
  }
}
