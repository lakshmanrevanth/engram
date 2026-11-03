// PATCH /api/problems/[id] — partial update (favorite, notes, topic, difficulty, status,
// title, url, tags, dateSolved, platform, problemNumber, code, nextRevisionOn)

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { addDays, getInitialSchedule, MASTERY_RECHECK_DAYS } from '@/lib/scheduling';
import { getUserPreferences } from '@/lib/preferences';
import { dateKeyInTz, getRequestTimeZone, shiftDateKey, startOfDayKeyInTz } from '@/lib/dates';
import {
  MAX_TITLE_LENGTH,
  codeforcesNumericId,
  initialScheduleFor,
  isHttpUrl,
  normalizeCode,
  normalizeTags,
  parseSolvedDate,
} from '@/lib/platforms/problem-input';

const PLATFORMS = ['LEETCODE', 'CODEFORCES', 'GFG', 'HACKERRANK', 'CODECHEF'];
const SIMPLE_FIELDS = ['isFavorite', 'notes', 'topic', 'difficulty', 'status'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const { id } = await params;
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    const bad = (error: string) => Response.json({ error }, { status: 400 });
    const data: Record<string, unknown> = {};
    let ladder: readonly number[] | undefined;
    const getLadder = async () => (ladder ??= (await getUserPreferences(userId)).ladderDays);

    if ('isFavorite' in body) data.isFavorite = Boolean(body.isFavorite);
    if ('notes' in body) data.notes = body.notes == null ? null : String(body.notes);
    if ('topic' in body) data.topic = String(body.topic ?? '').trim();
    if ('difficulty' in body) {
      const d = String(body.difficulty).toUpperCase();
      if (!['EASY', 'MEDIUM', 'HARD'].includes(d)) return bad('difficulty must be EASY, MEDIUM, or HARD');
      data.difficulty = d;
    }
    if ('title' in body) {
      const t = typeof body.title === 'string' ? body.title.trim() : '';
      if (!t) return bad('title cannot be empty');
      if (t.length > MAX_TITLE_LENGTH) return bad(`title must be at most ${MAX_TITLE_LENGTH} characters`);
      data.title = t;
    }
    if ('url' in body) {
      if (!isHttpUrl(body.url)) return bad('url must start with http:// or https://');
      data.url = body.url.trim();
    }
    if ('tags' in body) {
      const parsed = normalizeTags(body.tags);
      if ('error' in parsed) return bad(parsed.error);
      data.tags = parsed.tags;
    }
    let newSolvedAt: Date | null = null;
    if ('dateSolved' in body) {
      const parsed = parseSolvedDate(body.dateSolved);
      if ('error' in parsed) return bad(parsed.error);
      newSolvedAt = parsed.date;
      data.dateSolved = newSolvedAt;
    }
    if ('platform' in body) {
      const p = String(body.platform).toUpperCase();
      if (!PLATFORMS.includes(p)) return bad('Unknown platform');
      data.platform = p;
    }
    if ('code' in body) {
      if (body.code == null || body.code === '') data.code = null;
      else {
        const c = normalizeCode(body.code);
        if (!c) return bad('code must be a short identifier like 1234A');
        data.code = c;
      }
    }
    if ('problemNumber' in body) {
      const n = Number(body.problemNumber);
      if (!Number.isInteger(n) || n <= 0 || n > 2_000_000_000) return bad('problemNumber must be a positive whole number');
      data.problemNumber = n;
    }
    if ('status' in body) {
      const s = String(body.status).toUpperCase();
      if (['ACTIVE', 'MASTERED', 'RETIRED'].includes(s)) {
        data.status = s;
        // Keep the schedule consistent with the new status. Without this, a problem
        // imported as "archive" (due 2099) and then marked Active would never come due.
        const now = new Date();
        if (s === 'ACTIVE') {
          const initial = getInitialSchedule(now, await getLadder());
          data.currentStep = initial.currentStep;
          data.nextRevisionAt = initial.nextRevisionAt;
        } else if (s === 'MASTERED') {
          data.currentStep = 3;
          data.nextRevisionAt = addDays(now, MASTERY_RECHECK_DAYS);
        }
      }
    }

    // Manually move the next review to a calendar day ("YYYY-MM-DD", the user's local day).
    // No revision is logged and the ladder step is kept; only the date changes.
    let nextRevisionOn: string | null = null;
    if ('nextRevisionOn' in body) {
      const key = typeof body.nextRevisionOn === 'string' ? body.nextRevisionOn : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || isNaN(Date.parse(`${key}T00:00:00Z`))) {
        return bad('nextRevisionOn must be a date like 2026-11-20');
      }
      const todayKey = dateKeyInTz(new Date(), getRequestTimeZone(request));
      if (key < todayKey) return bad("The next review can't be in the past");
      if (key > shiftDateKey(todayKey, 3 * 366)) return bad('The next review must be within 3 years');
      nextRevisionOn = key;
    }

    if (Object.keys(data).length === 0 && !nextRevisionOn) {
      return Response.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    // Fast path for simple field edits — validates ownership and updates in one round trip.
    if (Object.keys(body).every((k) => SIMPLE_FIELDS.includes(k))) {
      const result = await prisma.problem.updateMany({ where: { id, userId }, data });
      if (result.count === 0) return Response.json({ error: 'Problem not found' }, { status: 404 });
      return Response.json({ success: true, id });
    }

    const existing = await prisma.problem.findFirst({
      where: { id, userId },
      select: { id: true, platform: true, problemNumber: true, revisionCount: true, status: true },
    });
    if (!existing) return Response.json({ error: 'Problem not found' }, { status: 404 });

    // Codeforces: a new code implies a new number, unless one was given explicitly.
    const platform = (data.platform as string | undefined) ?? existing.platform;
    if (platform === 'CODEFORCES' && typeof data.code === 'string' && !('problemNumber' in data)) {
      const n = codeforcesNumericId(data.code);
      if (n) data.problemNumber = n;
    }

    const problemNumber = (data.problemNumber as number | undefined) ?? existing.problemNumber;
    if (platform !== existing.platform || problemNumber !== existing.problemNumber) {
      const clash = await prisma.problem.findFirst({
        where: { userId, platform: platform as any, problemNumber, NOT: { id } },
        select: { id: true },
      });
      if (clash) {
        return Response.json({ error: 'Already tracked.', existingId: clash.id }, { status: 409 });
      }
    }

    // A new solve date moves the first review, but only before any review happened.
    if (newSolvedAt && existing.revisionCount === 0 && !('status' in data) && existing.status === 'ACTIVE') {
      const schedule = initialScheduleFor(newSolvedAt, await getLadder());
      data.currentStep = schedule.currentStep;
      data.nextRevisionAt = schedule.nextRevisionAt;
    }

    if (nextRevisionOn) {
      const finalStatus = (data.status as string | undefined) ?? existing.status;
      if (finalStatus === 'RETIRED') return bad('Retired problems have no next review. Make it Active first.');
      data.nextRevisionAt = startOfDayKeyInTz(nextRevisionOn, getRequestTimeZone(request));
    }

    try {
      const updated = await prisma.problem.update({ where: { id }, data });
      return Response.json({ success: true, id, problem: updated });
    } catch (e: any) {
      if (e?.code === 'P2002') return Response.json({ error: 'Already tracked.' }, { status: 409 });
      throw e;
    }
  } catch (e) {
    console.error('[PATCH /api/problems/[id]]', e);
    return Response.json({ error: 'Failed to update problem' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const { id } = await params;

    // Single query — validates ownership and deletes in one DB round trip
    const result = await prisma.problem.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      return Response.json({ error: 'Problem not found' }, { status: 404 });
    }

    return Response.json({ success: true, message: 'Problem deleted' });
  } catch (e) {
    console.error('[DELETE /api/problems/[id]]', e);
    return Response.json({ error: 'Failed to delete problem' }, { status: 500 });
  }
}

