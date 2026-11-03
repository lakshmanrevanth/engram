// GET  /api/concepts — the user's system design concepts with their review schedule
// POST /api/concepts — log a concept learned on a given day
//
// Concepts are stored as problems with platform SYSTEM_DESIGN, so they share the
// review ladder, the daily queue, streaks, the heatmap and reminder emails.

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getInitialSchedule } from '@/lib/scheduling';
import { getUserPreferences } from '@/lib/preferences';
import { getRequestTimeZone, dateKeyInTz } from '@/lib/dates';
import { CONCEPT_CATEGORIES, buildConceptNotes, getConcept } from '@/lib/concepts/library';
import { getPathArticle, pathCode, previousArticle, promptsFor } from '@/lib/concepts/paths';

const PLATFORM = 'SYSTEM_DESIGN' as const;
const LEVELS = ['EASY', 'MEDIUM', 'HARD'] as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const concepts = await prisma.problem.findMany({
      where: { userId: session.user.id, platform: PLATFORM },
      orderBy: { dateSolved: 'desc' },
      include: {
        revisions: { orderBy: { revisedAt: 'desc' }, take: 1, select: { confidence: true, revisedAt: true } },
      },
    });
    return Response.json(concepts);
  } catch (e) {
    console.error('[GET /api/concepts]', e);
    return Response.json({ error: 'Failed to load concepts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request' }, { status: 400 });
    const bad = (error: string) => Response.json({ error }, { status: 400 });

    // A learning-path article: everything comes from the path data, and articles
    // must be learned in order.
    const pathEntry = typeof body.pathArticleId === 'string' ? getPathArticle(body.pathArticleId) : undefined;
    if (body.pathArticleId && !pathEntry) return bad('Unknown path article');
    if (pathEntry) {
      const prev = previousArticle(pathEntry.article.id);
      if (prev) {
        const done = await prisma.problem.findFirst({
          where: { userId, platform: PLATFORM, code: pathCode(prev.id) },
          select: { id: true },
        });
        if (!done) {
          return Response.json(
            { error: `Finish “${prev.title}” first — this path goes one article at a time.`, code: 'PATH_ORDER' },
            { status: 409 }
          );
        }
      }
    }

    const concept = !pathEntry && typeof body.slug === 'string' ? getConcept(body.slug) : undefined;
    if (body.slug && !pathEntry && !concept) return bad('Unknown concept');

    let title = String(pathEntry?.article.title ?? body.title ?? concept?.title ?? '').trim();
    if (!title) return bad('Give the concept a name');
    if (title.length > 200) return bad('Name must be at most 200 characters');

    // Path articles are grouped under their path's name; everything else uses a library category.
    const category = pathEntry ? pathEntry.path.title : String(body.category ?? concept?.category ?? '').trim();
    if (!pathEntry && !(CONCEPT_CATEGORIES as readonly string[]).includes(category)) return bad('Pick a category');

    const level = String(pathEntry?.path.level ?? body.level ?? concept?.level ?? 'MEDIUM').toUpperCase();
    if (!(LEVELS as readonly string[]).includes(level)) return bad('Level must be EASY, MEDIUM or HARD');

    const url = pathEntry ? pathEntry.article.url : typeof body.url === 'string' ? body.url.trim() : '';
    if (url && !/^https?:\/\//i.test(url)) return bad('Link must start with http:// or https://');

    const userNotes = typeof body.notes === 'string' ? body.notes.slice(0, 20000) : '';

    // The day it was learned, in the user's timezone ("YYYY-MM-DD"). Defaults to today.
    const tz = getRequestTimeZone(request);
    const now = new Date();
    const todayKey = dateKeyInTz(now, tz);
    const learnedKey = typeof body.learnedOn === 'string' && body.learnedOn ? body.learnedOn : todayKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(learnedKey) || isNaN(Date.parse(learnedKey))) return bad('Invalid date');
    if (learnedKey > todayKey) return bad('The date learned cannot be in the future');
    // Noon UTC keeps the calendar day stable when shown in any timezone.
    const learnedAt = learnedKey === todayKey ? now : new Date(`${learnedKey}T12:00:00Z`);

    if (pathEntry) {
      // Path articles are identified by their code, so the path can always move on.
      const already = await prisma.problem.findFirst({
        where: { userId, platform: PLATFORM, code: pathCode(pathEntry.article.id) },
        select: { id: true },
      });
      if (already) return Response.json({ error: 'Already learned.', existingId: already.id }, { status: 409 });
      // If a hand-added concept already uses this title, keep both by naming the path one.
      const clash = await prisma.problem.findFirst({
        where: { userId, platform: PLATFORM, title: { equals: title, mode: 'insensitive' } },
        select: { id: true },
      });
      if (clash) title = `${title} (${pathEntry.path.title})`;
    } else {
      const existing = await prisma.problem.findFirst({
        where: { userId, platform: PLATFORM, title: { equals: title, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) return Response.json({ error: 'Already tracked.', existingId: existing.id }, { status: 409 });
    }

    // First review follows the user's ladder from the day it was learned.
    // If that day has already passed, the concept is due today.
    const { ladderDays } = await getUserPreferences(userId);
    const schedule = getInitialSchedule(learnedAt, ladderDays);
    const nextRevisionAt = schedule.nextRevisionAt < now ? now : schedule.nextRevisionAt;

    const create = async () => {
      const last = await prisma.problem.findFirst({
        where: { userId, platform: PLATFORM },
        orderBy: { problemNumber: 'desc' },
        select: { problemNumber: true },
      });
      return prisma.problem.create({
        data: {
          userId,
          platform: PLATFORM,
          problemNumber: (last?.problemNumber ?? 0) + 1,
          code: pathEntry ? pathCode(pathEntry.article.id) : concept?.slug ?? null,
          title,
          url,
          difficulty: level as (typeof LEVELS)[number],
          topic: category,
          tags: pathEntry ? ['system-design', pathEntry.path.slug] : ['system-design'],
          notes:
            (pathEntry
              ? buildConceptNotes(userNotes, {
                  slug: pathEntry.article.id,
                  title,
                  category,
                  level: level as (typeof LEVELS)[number],
                  summary: pathEntry.article.summary,
                  prompts: promptsFor(pathEntry.article),
                })
              : buildConceptNotes(userNotes, concept)) || null,
          dateSolved: learnedAt,
          status: 'ACTIVE',
          currentStep: schedule.currentStep,
          nextRevisionAt,
        },
      });
    };

    try {
      return Response.json(await create(), { status: 201 });
    } catch (e: unknown) {
      const err = e as { code?: string; meta?: { target?: unknown } };
      if (err?.code === 'P2002') {
        // Same code already exists (e.g. "Mark as learned" double-clicked): already learned.
        if (String(err.meta?.target ?? '').includes('code')) {
          return Response.json({ error: 'Already learned.' }, { status: 409 });
        }
        // Two concepts added at the same moment raced for the same number; retry once.
        return Response.json(await create(), { status: 201 });
      }
      throw e;
    }
  } catch (e) {
    console.error('[POST /api/concepts]', e);
    return Response.json({ error: 'Failed to save concept' }, { status: 500 });
  }
}
