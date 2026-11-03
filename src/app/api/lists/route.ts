// GET  /api/lists — the user's lists with counts and member problem ids
// POST /api/lists — create { name }

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MAX_LISTS, isUniqueViolation, parseListName } from './helpers';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const lists = await prisma.problemList.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, createdAt: true, problems: { select: { id: true } } },
    });
    return Response.json(
      lists.map((l) => ({
        id: l.id,
        name: l.name,
        createdAt: l.createdAt,
        count: l.problems.length,
        problemIds: l.problems.map((p) => p.id),
      })),
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (e) {
    console.error('[GET /api/lists]', e);
    return Response.json({ error: 'Failed to fetch lists' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const body = await request.json().catch(() => ({}));
    const parsed = parseListName(body?.name);
    if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 });

    const existing = await prisma.problemList.count({ where: { userId } });
    if (existing >= MAX_LISTS) return Response.json({ error: `You can have at most ${MAX_LISTS} lists` }, { status: 400 });

    try {
      const list = await prisma.problemList.create({
        data: { userId, name: parsed.name },
        select: { id: true, name: true, createdAt: true },
      });
      return Response.json({ ...list, count: 0, problemIds: [] }, { status: 201 });
    } catch (e) {
      if (isUniqueViolation(e)) return Response.json({ error: 'A list with that name already exists' }, { status: 409 });
      throw e;
    }
  } catch (e) {
    console.error('[POST /api/lists]', e);
    return Response.json({ error: 'Failed to create list' }, { status: 500 });
  }
}
