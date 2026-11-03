// GET  /api/problems — list all problems for the current user
// POST /api/problems — add a new problem to the tracker

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getResolver } from '@/lib/platforms';
import { getUserPreferences } from '@/lib/preferences';
import type { ProblemMeta } from '@/lib/platforms/types';
import {
  MAX_TITLE_LENGTH,
  codeforcesNumericId,
  hashToProblemNumber,
  initialScheduleFor,
  isHttpUrl,
  normalizeCode,
  normalizeTags,
  parseSolvedDate,
} from '@/lib/platforms/problem-input';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const { searchParams } = request.nextUrl;
    const rawStatus = searchParams.get('status')?.toUpperCase();
    if (rawStatus && !['ACTIVE', 'MASTERED', 'RETIRED'].includes(rawStatus)) {
      return Response.json({ error: 'status must be ACTIVE, MASTERED or RETIRED' }, { status: 400 });
    }
    const status = rawStatus || undefined;
    const topic = searchParams.get('topic') ?? undefined;

    // Direct Prisma query — no server-side unstable_cache.
    // SWR handles client-side caching; double-caching caused stale-data
    // race conditions where mutations appeared lost.
    const problems = await prisma.problem.findMany({
      where: {
        userId,
        ...(status ? { status: status as any } : {}),
        ...(topic ? { topic } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        revisions: {
          orderBy: { revisedAt: 'desc' },
          take: 1,
        },
      },
    });

    return Response.json(problems, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (e) {
    console.error('[GET /api/problems]', e);
    return Response.json({ error: 'Failed to fetch problems' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const body = await request.json();
    const { platform, problemNumber, notes, dateSolved, customFields } = body ?? {};

    if (!platform || typeof platform !== 'string') {
      return Response.json({ error: 'platform is required' }, { status: 400 });
    }
    // System design concepts are added through /api/concepts.
    if (!['LEETCODE', 'CODEFORCES', 'GFG', 'HACKERRANK', 'CODECHEF'].includes(platform)) {
      return Response.json({ error: 'Unknown platform' }, { status: 400 });
    }

    const now = new Date();
    let solvedAt = now;
    if (dateSolved != null && dateSolved !== '') {
      const parsed = parseSolvedDate(dateSolved, now);
      if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 });
      solvedAt = parsed.date;
    }

    let tags: string[] = [];
    if (body.tags != null) {
      const parsed = normalizeTags(body.tags);
      if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 });
      tags = parsed.tags;
    }

    const manualTitle = typeof body.title === 'string' ? body.title.trim() : '';
    const manualUrl = typeof body.url === 'string' ? body.url.trim() : '';
    if (manualUrl && !isHttpUrl(manualUrl)) {
      return Response.json({ error: 'url must start with http:// or https://' }, { status: 400 });
    }
    if (manualTitle.length > MAX_TITLE_LENGTH) {
      return Response.json({ error: `title must be at most ${MAX_TITLE_LENGTH} characters` }, { status: 400 });
    }

    // Resolve from the dataset when we have an identifier; the client's edits
    // (title, difficulty, topic) take precedence over the looked-up values.
    const resolver = getResolver(platform);
    const identifier = String(body.code || problemNumber || '').trim();
    let resolved: ProblemMeta | null = null;
    if (resolver && identifier && identifier !== '0') {
      const result = await resolver.resolve(identifier);
      if (result.found) resolved = result.data;
    }

    const meta = {
      title: manualTitle || resolved?.title || '',
      difficulty: String(body.difficulty || resolved?.difficulty || '').toUpperCase(),
      topic: typeof body.topic === 'string' ? body.topic.trim() : (resolved?.topic ?? ''),
      url: manualUrl || resolved?.url || '',
    };
    if (meta.topic === 'General') meta.topic = '';

    if (!meta.title || !meta.url) {
      return Response.json(
        { error: 'Problem not found. Provide title, difficulty, and url manually.' },
        { status: 422 }
      );
    }

    // Validate difficulty — it's a required enum; empty string will crash Prisma
    if (!['EASY', 'MEDIUM', 'HARD'].includes(meta.difficulty)) {
      return Response.json({ error: 'difficulty is required and must be EASY, MEDIUM, or HARD' }, { status: 400 });
    }

    const code = normalizeCode(resolved?.code) ?? normalizeCode(body.code) ??
      (platform !== 'LEETCODE' ? normalizeCode(problemNumber) : null);

    let finalProblemNumber =
      typeof resolved?.problemNumber === 'number' && resolved.problemNumber > 0
        ? resolved.problemNumber
        : /^\d+$/.test(String(problemNumber ?? '').trim()) ? parseInt(String(problemNumber), 10) : 0;

    if (finalProblemNumber <= 0 && platform === 'CODEFORCES' && code) {
      finalProblemNumber = codeforcesNumericId(code) ?? 0;
    }
    // No natural number: hash the LeetCode slug (backwards compatible) or the URL
    // so manual entries never collide on 0.
    if (finalProblemNumber <= 0) {
      const slug = platform === 'LEETCODE' ? meta.url.match(/leetcode\.com\/problems\/([^/?#]+)/)?.[1] : null;
      finalProblemNumber = hashToProblemNumber(slug ?? (code || meta.url.replace(/\/+$/, '').toLowerCase()));
    }

    const prefs = await getUserPreferences(userId);
    const schedule = initialScheduleFor(solvedAt, prefs.ladderDays, now);

    try {
      const problem = await prisma.problem.create({
        data: {
          userId,
          platform: platform as any,
          problemNumber: finalProblemNumber,
          code,
          title: meta.title,
          url: meta.url,
          difficulty: meta.difficulty as any,
          topic: meta.topic,
          tags,
          dateSolved: solvedAt,
          notes: typeof notes === 'string' && notes.trim() ? notes : null,
          customFields: customFields ?? {},
          currentStep: schedule.currentStep,
          nextRevisionAt: schedule.nextRevisionAt,
          status: schedule.status,
        },
      });

      return Response.json(problem, { status: 201 });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const existing = await prisma.problem.findFirst({
          where: { userId, platform: platform as any, problemNumber: finalProblemNumber },
          select: { id: true, title: true },
        });
        return Response.json(
          { error: 'Already tracked.', existingId: existing?.id ?? null, existingTitle: existing?.title ?? null },
          { status: 409 }
        );
      }
      throw e; // rethrow so the outer catch returns a proper 500
    }
  } catch (e) {
    console.error('[POST /api/problems]', e);
    return Response.json({ error: 'Failed to create problem' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === 'string')) {
      return Response.json({ error: 'ids array is required' }, { status: 400 });
    }

    const deleted = await prisma.problem.deleteMany({
      where: {
        id: { in: ids },
        userId,
      },
    });

    return Response.json({ count: deleted.count, message: `Successfully deleted ${deleted.count} problems` });
  } catch (e) {
    console.error('[DELETE /api/problems]', e);
    return Response.json({ error: 'Failed to delete problems' }, { status: 500 });
  }
}

