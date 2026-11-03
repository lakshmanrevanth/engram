// POST /api/problems/import — bulk import from CSV / Excel rows or a Recall JSON backup.
// Body: ImportRequestBody (see src/lib/import-utils.ts). Everything runs in one transaction.

import type { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  MAX_IMPORT_ROWS,
  MAX_REVISIONS_PER_PROBLEM,
  buildDuplicateUpdate,
  parseList,
  type DuplicateStrategy,
  type ImportColumnDef,
  type ImportedRevision,
  type ProcessedProblem,
} from '@/lib/import-utils';
import {
  MAX_COLUMNS,
  isColumnType,
  normalizeOptions,
  parseCustomValue,
  readCustomFields,
  toCustomColumn,
  type CustomColumn,
} from '@/lib/custom-columns';

const VALID_PLATFORMS = new Set(['LEETCODE', 'CODEFORCES', 'GFG', 'HACKERRANK', 'CODECHEF', 'SYSTEM_DESIGN']);
const VALID_DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD']);
const VALID_STATUSES = new Set(['ACTIVE', 'MASTERED', 'RETIRED']);
const VALID_CONFIDENCE = new Set(['CLEAN', 'SHAKY', 'STRUGGLED']);
const DUPLICATE_STRATEGIES = new Set<DuplicateStrategy>(['skip', 'overwrite', 'merge']);
const BATCH_SIZE = 200;
const MAX_LISTS = 100;

type Clean = ProcessedProblem & { key: string; defaulted?: string[] };

function bad(error: string) {
  return Response.json({ error }, { status: 400 });
}

function cut(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// Postgres rejects timestamps outside its range (and JS accepts years like -200000),
// which would abort the whole import transaction with a 500.
function inRange(d: Date): boolean {
  const y = d.getUTCFullYear();
  return !isNaN(d.getTime()) && y >= 1900 && y <= 9999;
}

/** A real calendar day ("2024-02-31" or "2024-13-01" would roll over or fail the insert). */
function isRealDay(key: string): boolean {
  const d = new Date(`${key}T00:00:00.000Z`);
  return inRange(d) && d.toISOString().slice(0, 10) === key;
}

function cleanRevisions(input: unknown): ImportedRevision[] {
  if (!Array.isArray(input)) return [];
  const out: ImportedRevision[] = [];
  for (const r of input.slice(0, MAX_REVISIONS_PER_PROBLEM)) {
    const at = new Date(r?.revisedAt);
    if (!inRange(at) || !VALID_CONFIDENCE.has(r?.confidence)) continue;
    const step = (n: unknown) => (Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 3 ? (n as number) : 0);
    out.push({
      revisedAt: at.toISOString(),
      confidence: r.confidence,
      type: r.type === 'RECHECK' ? 'RECHECK' : 'REGULAR',
      stepBefore: step(r.stepBefore),
      stepAfter: step(r.stepAfter),
    });
  }
  return out;
}

/** Validates one incoming problem; returns an error message or the cleaned value. */
function clean(p: any, idx: number): Clean | string {
  if (!p || typeof p !== 'object') return `Problem at row ${idx} is not an object`;
  const title = cut(p.title, 300);
  if (!title) return `Problem at row ${idx} is missing a title`;
  if (!VALID_PLATFORMS.has(p.platform)) return `Problem at row ${idx} has invalid platform "${p.platform}"`;
  if (!Number.isInteger(p.problemNumber) || p.problemNumber <= 0 || p.problemNumber > 2147483647) {
    return `Problem at row ${idx} has invalid problemNumber`;
  }
  if (!VALID_DIFFICULTIES.has(p.difficulty)) return `Problem at row ${idx} has invalid difficulty "${p.difficulty}"`;
  const dateSolved = new Date(p.dateSolved);
  if (!inRange(dateSolved)) return `Problem at row ${idx} has invalid dateSolved`;
  const next = new Date(p.nextRevisionAt);
  if (!inRange(next)) return `Problem at row ${idx} has invalid nextRevisionAt`;

  const currentStep = Number.isInteger(p.currentStep) && p.currentStep >= 0 && p.currentStep <= 3 ? p.currentStep : 0;
  const revisions = cleanRevisions(p.revisions);
  return {
    key: `${p.platform}:${p.problemNumber}`,
    platform: p.platform,
    problemNumber: p.problemNumber,
    title,
    url: cut(p.url, 2000) || '#',
    difficulty: p.difficulty,
    topic: cut(p.topic, 100) || 'General',
    dateSolved: dateSolved.toISOString(),
    notes: cut(p.notes, 20000) || null,
    customFields: readCustomFields(p.customFields),
    code: cut(p.code, 40) || null,
    tags: Array.isArray(p.tags) ? parseList(p.tags.filter((t: unknown) => typeof t === 'string').join(';')) : undefined,
    lists: Array.isArray(p.lists) ? parseList(p.lists.filter((t: unknown) => typeof t === 'string').join(';'), false, MAX_LISTS) : undefined,
    isFavorite: typeof p.isFavorite === 'boolean' ? p.isFavorite : undefined,
    status: VALID_STATUSES.has(p.status) ? p.status : 'ACTIVE',
    currentStep,
    nextRevisionAt: next.toISOString(),
    // Int column: anything past 2^31-1 would fail the transaction.
    revisionCount: Number.isInteger(p.revisionCount) && p.revisionCount >= 0 && p.revisionCount <= 1_000_000 ? p.revisionCount : undefined,
    revisions,
    defaulted: Array.isArray(p.defaulted) ? p.defaulted.filter((d: unknown) => typeof d === 'string') : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.problems)) {
      return bad('Request body must include a "problems" array');
    }
    if (body.problems.length === 0) return bad('No problems provided to import');
    if (body.problems.length > MAX_IMPORT_ROWS) {
      return bad(`Maximum ${MAX_IMPORT_ROWS.toLocaleString('en-US')} problems can be imported at once`);
    }
    const duplicateStrategy: DuplicateStrategy = body.duplicateStrategy ?? 'skip';
    if (!DUPLICATE_STRATEGIES.has(duplicateStrategy)) {
      return bad('duplicateStrategy must be skip, overwrite or merge');
    }

    // Validate and de-duplicate (first occurrence wins)
    const rows: Clean[] = [];
    const seen = new Set<string>();
    let inFileDuplicates = 0;
    for (let i = 0; i < body.problems.length; i++) {
      const c = clean(body.problems[i], i + 1);
      if (typeof c === 'string') return bad(c);
      if (seen.has(c.key)) {
        inFileDuplicates++;
        continue;
      }
      seen.add(c.key);
      rows.push(c);
    }

    // Column definitions: typed ones from a backup, plain names (text), and any key used in customFields
    const wantedCols: ImportColumnDef[] = [];
    const wantedLower = new Set<string>();
    const want = (name: unknown, type: unknown = 'text', options: unknown = []) => {
      const n = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
      if (!n || n.length > 40 || wantedLower.has(n.toLowerCase())) return;
      const opts = normalizeOptions(options);
      wantedLower.add(n.toLowerCase());
      wantedCols.push({ name: n, type: isColumnType(type) ? type : 'text', options: opts.ok ? opts.value : [] });
    };
    if (Array.isArray(body.columnDefs)) for (const c of body.columnDefs) want(c?.name, c?.type, c?.options);
    if (Array.isArray(body.customColumns)) for (const c of body.customColumns) want(c);
    for (const r of rows) for (const k of Object.keys(r.customFields ?? {})) want(k);

    const listNames = parseList(rows.flatMap((r) => r.lists ?? []).join(';'), false, MAX_LISTS);
    const streakLogs: { date: string; completed: boolean }[] = Array.isArray(body.streakLogs)
      ? body.streakLogs
          .filter((s: any) => typeof s?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && isRealDay(s.date))
          .slice(0, 5000)
      : [];

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Columns
        const existingCols = await tx.userColumnConfig.findMany({ where: { userId }, orderBy: { order: 'asc' } });
        const colsByLower = new Map<string, CustomColumn>(existingCols.map((c) => [c.name.toLowerCase(), toCustomColumn(c)]));
        let nextOrder = existingCols.reduce((m, c) => Math.max(m, c.order + 1), 0);
        const customColumnsCreated: string[] = [];
        for (const def of wantedCols) {
          if (colsByLower.has(def.name.toLowerCase())) continue;
          if (colsByLower.size >= MAX_COLUMNS) break;
          const created = await tx.userColumnConfig.create({
            data: {
              userId,
              name: def.name,
              type: def.type,
              options: def.type === 'select' ? def.options : undefined,
              order: nextOrder++,
            },
          });
          colsByLower.set(def.name.toLowerCase(), toCustomColumn(created));
          customColumnsCreated.push(def.name);
        }
        // Store values under the column's canonical name, normalized for its type when valid.
        for (const r of rows) {
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries(r.customFields ?? {})) {
            const col = colsByLower.get(k.trim().toLowerCase());
            if (!col || !v) continue;
            const parsed = parseCustomValue(col, v);
            const value = parsed.ok ? parsed.value : v.slice(0, 1000);
            if (value) out[col.name] = value;
          }
          r.customFields = out;
        }

        // 2. Lists (matched case-insensitively to existing ones)
        const listIdByLower = new Map<string, string>();
        const listsCreated: string[] = [];
        if (listNames.length) {
          const existingLists = await tx.problemList.findMany({ where: { userId }, select: { id: true, name: true } });
          for (const l of existingLists) listIdByLower.set(l.name.toLowerCase(), l.id);
          for (const name of listNames) {
            if (listIdByLower.has(name.toLowerCase())) continue;
            const l = await tx.problemList.create({ data: { userId, name }, select: { id: true } });
            listIdByLower.set(name.toLowerCase(), l.id);
            listsCreated.push(name);
          }
        }

        // 3. Split into new vs existing
        const numbers = Array.from(new Set(rows.map((r) => r.problemNumber)));
        const existing = await tx.problem.findMany({
          where: { userId, problemNumber: { in: numbers } },
          select: {
            id: true, platform: true, problemNumber: true, title: true, url: true, difficulty: true, topic: true,
            dateSolved: true, notes: true, code: true, tags: true, customFields: true, isFavorite: true,
            status: true, currentStep: true, nextRevisionAt: true, revisionCount: true,
          },
        });
        const existingByKey = new Map(existing.map((e) => [`${e.platform}:${e.problemNumber}`, e]));
        const toCreate = rows.filter((r) => !existingByKey.has(r.key));
        const dupes = rows.filter((r) => existingByKey.has(r.key));

        // 4. Create new problems
        let imported = 0;
        for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
          const batch = toCreate.slice(i, i + BATCH_SIZE).map((r): Prisma.ProblemCreateManyInput => ({
            userId,
            platform: r.platform,
            problemNumber: r.problemNumber,
            code: r.code ?? null,
            title: r.title,
            url: r.url,
            difficulty: r.difficulty,
            topic: r.topic,
            tags: r.tags ?? [],
            dateSolved: new Date(r.dateSolved),
            notes: r.notes,
            customFields: r.customFields ?? {},
            isFavorite: r.isFavorite ?? false,
            status: r.status,
            currentStep: r.currentStep,
            nextRevisionAt: new Date(r.nextRevisionAt),
            revisionCount: r.revisionCount ?? r.revisions?.length ?? 0,
          }));
          const res = await tx.problem.createMany({ data: batch, skipDuplicates: true });
          imported += res.count;
        }

        // 5. Duplicates: skip / overwrite / merge
        let updated = 0;
        let skipped = inFileDuplicates;
        const touched: Clean[] = [];
        for (const r of dupes) {
          const ex = existingByKey.get(r.key)!;
          if (duplicateStrategy === 'skip') {
            skipped++;
            continue;
          }
          const data = buildDuplicateUpdate(ex, r, duplicateStrategy);
          touched.push(r);
          if (Object.keys(data).length === 0) {
            skipped++;
            continue;
          }
          await tx.problem.update({ where: { id: ex.id }, data: data as Prisma.ProblemUpdateInput });
          updated++;
        }

        // 6. Resolve ids for revisions and lists
        const idRows = await tx.problem.findMany({
          where: { userId, problemNumber: { in: numbers } },
          select: { id: true, platform: true, problemNumber: true },
        });
        const idByKey = new Map(idRows.map((p) => [`${p.platform}:${p.problemNumber}`, p.id]));
        const createdKeys = new Set(toCreate.map((r) => r.key));

        // 7. Revisions (backups)
        const revisionData: Prisma.RevisionCreateManyInput[] = [];
        const withRevs = [...toCreate, ...touched].filter((r) => r.revisions?.length && idByKey.has(r.key));
        const mergeIds = withRevs
          .filter((r) => !createdKeys.has(r.key) && duplicateStrategy === 'merge')
          .map((r) => idByKey.get(r.key)!);
        const overwriteIds = withRevs
          .filter((r) => !createdKeys.has(r.key) && duplicateStrategy === 'overwrite')
          .map((r) => idByKey.get(r.key)!);
        if (overwriteIds.length) await tx.revision.deleteMany({ where: { problemId: { in: overwriteIds } } });
        const existingRevs = mergeIds.length
          ? await tx.revision.findMany({ where: { problemId: { in: mergeIds } }, select: { problemId: true, revisedAt: true } })
          : [];
        const revSeen = new Set(existingRevs.map((r) => `${r.problemId}:${r.revisedAt.toISOString()}`));
        for (const r of withRevs) {
          const problemId = idByKey.get(r.key)!;
          for (const rev of r.revisions!) {
            if (revSeen.has(`${problemId}:${rev.revisedAt}`)) continue;
            revSeen.add(`${problemId}:${rev.revisedAt}`);
            revisionData.push({ problemId, ...rev, revisedAt: new Date(rev.revisedAt) });
          }
        }
        for (let i = 0; i < revisionData.length; i += 1000) {
          await tx.revision.createMany({ data: revisionData.slice(i, i + 1000) });
        }

        // 8. List membership (union; never removes)
        for (const [lower, listId] of listIdByLower) {
          const ids = [...toCreate, ...touched]
            .filter((r) => r.lists?.some((l) => l.toLowerCase() === lower))
            .map((r) => idByKey.get(r.key))
            .filter((id): id is string => !!id);
          if (ids.length) {
            await tx.problemList.update({
              where: { id: listId },
              data: { problems: { connect: ids.map((id) => ({ id })) } },
            });
          }
        }

        // 9. Streak history (backups)
        let streakDaysImported = 0;
        if (streakLogs.length) {
          const res = await tx.streakLog.createMany({
            data: streakLogs.map((s) => ({ userId, date: new Date(`${s.date}T00:00:00.000Z`), completed: s.completed === true })),
            skipDuplicates: true,
          });
          streakDaysImported = res.count;
        }

        return {
          imported,
          updated,
          skipped: skipped + (toCreate.length - imported),
          customColumnsCreated,
          listsCreated,
          revisionsImported: revisionData.length,
          streakDaysImported,
        };
      },
      { timeout: 60000, maxWait: 10000 }
    );

    return Response.json(
      { ...result, total: body.problems.length, duplicateStrategy },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/problems/import]', error);
    return Response.json({ error: 'Failed to import problems' }, { status: 500 });
  }
}
