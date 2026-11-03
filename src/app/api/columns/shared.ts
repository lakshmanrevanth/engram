// Shared column mutations used by /api/columns and /api/columns/[id].

import { prisma } from '@/lib/prisma';
import {
  distinctValues,
  isColumnType,
  normalizeOptions,
  readCustomFields,
  removeFieldKey,
  renameFieldKey,
  reorderIds,
  toCustomColumn,
  validateColumnName,
  type ColumnType,
} from '@/lib/custom-columns';

const TX_OPTIONS = { timeout: 30000, maxWait: 10000 };

export async function deleteColumn(userId: string, id: string): Promise<Response> {
  const result = await prisma.$transaction(async (tx) => {
    const column = await tx.userColumnConfig.findFirst({ where: { id, userId } });
    if (!column) return null;

    // Drop the value from every problem so a later column with the same name starts empty.
    const problems = await tx.problem.findMany({ where: { userId }, select: { id: true, customFields: true } });
    let cleared = 0;
    for (const p of problems) {
      const next = removeFieldKey(readCustomFields(p.customFields), column.name);
      if (next) {
        await tx.problem.update({ where: { id: p.id }, data: { customFields: next } });
        cleared++;
      }
    }
    await tx.userColumnConfig.delete({ where: { id } });
    return { cleared };
  }, TX_OPTIONS);

  if (!result) return Response.json({ error: 'Column not found' }, { status: 404 });
  return Response.json({ success: true, cleared: result.cleared });
}

export async function updateColumn(userId: string, id: string, body: Record<string, unknown>): Promise<Response> {
  if ('type' in body && !isColumnType(body.type)) {
    return Response.json({ error: 'Type must be one of text, select, date, checkbox, url' }, { status: 400 });
  }
  if ('order' in body && (typeof body.order !== 'number' || !Number.isInteger(body.order) || body.order < 0)) {
    return Response.json({ error: 'order must be a non-negative whole number' }, { status: 400 });
  }
  let options: string[] | undefined;
  if ('options' in body) {
    const opts = normalizeOptions(body.options);
    if (!opts.ok) return Response.json({ error: opts.error }, { status: 400 });
    options = opts.value;
  }

  type Outcome = { error: string; status: number } | { column: ReturnType<typeof toCustomColumn>; renamed: number };

  const outcome: Outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
    const all = await tx.userColumnConfig.findMany({
      where: { userId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    const current = all.find((c) => c.id === id);
    if (!current) return { error: 'Column not found', status: 404 };

    const data: { name?: string; type?: ColumnType; options?: string[] } = {};
    let renamed = 0;

    if ('name' in body) {
      const name = validateColumnName(body.name, all, id);
      if (!name.ok) return { error: name.error, status: name.error.includes('already exists') ? 409 : 400 };
      if (name.value !== current.name) {
        data.name = name.value;
        const problems = await tx.problem.findMany({ where: { userId }, select: { id: true, customFields: true } });
        for (const p of problems) {
          const next = renameFieldKey(readCustomFields(p.customFields), current.name, name.value);
          if (next) {
            await tx.problem.update({ where: { id: p.id }, data: { customFields: next } });
            renamed++;
          }
        }
      }
    }

    const nextType = (body.type as ColumnType | undefined) ?? (isColumnType(current.type) ? current.type : 'text');
    if (body.type !== undefined) data.type = nextType;
    if (options !== undefined) data.options = options;

    // Switching to select without options: seed them from the values already entered.
    const currentOptions = toCustomColumn(current).options;
    if (nextType === 'select' && options === undefined && currentOptions.length === 0 && current.type !== 'select') {
      const key = data.name ?? current.name;
      const problems = await tx.problem.findMany({ where: { userId }, select: { customFields: true } });
      data.options = distinctValues(problems.map((p) => readCustomFields(p.customFields)[key] ?? ''));
    }

    if (typeof body.order === 'number') {
      const ids = reorderIds(all.map((c) => c.id), id, body.order);
      for (let i = 0; i < ids.length; i++) {
        const col = all.find((c) => c.id === ids[i])!;
        if (col.order !== i) await tx.userColumnConfig.update({ where: { id: col.id }, data: { order: i } });
      }
    }

    const updated = Object.keys(data).length
      ? await tx.userColumnConfig.update({ where: { id }, data })
      : await tx.userColumnConfig.findFirst({ where: { id } });
    return { column: toCustomColumn(updated ?? current), renamed };
  }, TX_OPTIONS);

  if ('error' in outcome) return Response.json({ error: outcome.error }, { status: outcome.status });
  return Response.json({ ...outcome.column, renamed: outcome.renamed });
}
