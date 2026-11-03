// GET /api/export?format=json|csv&ids=a,b,c
//   json (default): versioned full backup (v2) that the import modal can restore
//   csv: all user-facing fields + custom columns, formula-injection safe
//   ids: optional comma-separated problem ids to export only those (selected / filtered rows)
// POST /api/export { format, ids: string[] } — same, for selections too long for a URL

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { buildBackup, buildCsv } from './format';

const MAX_IDS = 5000;

type Format = 'json' | 'csv';

function parseRequest(format: unknown, ids: string[] | null): { format: Format; ids: string[] | null } | Response {
  const f = typeof format === 'string' ? format.toLowerCase() : 'json';
  if (f !== 'json' && f !== 'csv') return Response.json({ error: 'format must be json or csv' }, { status: 400 });
  const unique = ids ? Array.from(new Set(ids.map((s) => String(s).trim()).filter(Boolean))) : null;
  if (unique && unique.length === 0) return Response.json({ error: 'ids is empty' }, { status: 400 });
  if (unique && unique.length > MAX_IDS) {
    return Response.json({ error: `At most ${MAX_IDS} ids can be exported at once` }, { status: 400 });
  }
  return { format: f, ids: unique };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const idsParam = params.get('ids');
    const parsed = parseRequest(params.get('format') ?? 'json', idsParam !== null ? idsParam.split(',') : null);
    if (parsed instanceof Response) return parsed;
    return await exportData(session.user.id, parsed.format, parsed.ids);
  } catch (e) {
    console.error('[GET /api/export]', e);
    return Response.json({ error: 'Failed to export data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body' }, { status: 400 });
    if (body.ids !== undefined && !Array.isArray(body.ids)) {
      return Response.json({ error: 'ids must be an array' }, { status: 400 });
    }
    const parsed = parseRequest(body.format ?? 'json', body.ids ?? null);
    if (parsed instanceof Response) return parsed;
    return await exportData(session.user.id, parsed.format, parsed.ids);
  } catch (e) {
    console.error('[POST /api/export]', e);
    return Response.json({ error: 'Failed to export data' }, { status: 500 });
  }
}

async function exportData(userId: string, format: Format, ids: string[] | null): Promise<Response> {
  const [problems, columns] = await Promise.all([
    prisma.problem.findMany({
      where: { userId, ...(ids ? { id: { in: ids } } : {}) },
      include: {
        revisions: { orderBy: { revisedAt: 'asc' } },
        lists: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.userColumnConfig.findMany({ where: { userId }, orderBy: { order: 'asc' } }),
  ]);

  const stamp = new Date().toISOString().split('T')[0];
  const suffix = ids ? '_selection' : '';

  if (format === 'csv') {
    return new Response(buildCsv(problems, columns), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="recall_problems${suffix}_${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const [user, lists, streakLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        timezone: true,
        dailyGoal: true,
        defaultPlatform: true,
        ladderDays: true,
        goalBasedStreak: true,
      },
    }),
    prisma.problemList.findMany({ where: { userId }, select: { name: true }, orderBy: { createdAt: 'asc' } }),
    ids ? Promise.resolve([]) : prisma.streakLog.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
  ]);

  const usedLists = ids ? lists.filter((l) => problems.some((p) => p.lists.some((pl) => pl.name === l.name))) : lists;
  const backup = buildBackup({
    user: user ? { name: user.name, email: user.email } : null,
    preferences: user
      ? {
          timezone: user.timezone,
          dailyGoal: user.dailyGoal,
          defaultPlatform: user.defaultPlatform,
          ladderDays: user.ladderDays,
          goalBasedStreak: user.goalBasedStreak,
        }
      : {},
    columns,
    lists: usedLists,
    problems,
    streakLogs,
    partial: !!ids,
  });

  return new Response(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="recall_backup${suffix}_${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
