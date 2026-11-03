// Pure helpers for GET /api/export (JSON backup v2 and CSV).

import { EXPORT_CSV_HEADERS } from '@/lib/import-utils';
import { readCustomFields, toCustomColumn } from '@/lib/custom-columns';

export const BACKUP_VERSION = 2;

export type ExportProblemRow = {
  platform: string;
  problemNumber: number;
  code: string | null;
  title: string;
  url: string;
  difficulty: string;
  topic: string;
  tags: string[];
  dateSolved: Date;
  notes: string | null;
  customFields: unknown;
  isFavorite: boolean;
  status: string;
  currentStep: number;
  nextRevisionAt: Date;
  revisionCount: number;
  createdAt: Date;
  lists: { name: string }[];
  revisions: {
    revisedAt: Date;
    confidence: string;
    type: string;
    stepBefore: number;
    stepAfter: number;
  }[];
};

export type ExportColumnRow = { id: string; name: string; type: string; options: unknown; order: number };

/** Cells starting with = + - @ tab or CR are prefixed with ' so spreadsheets don't run them as formulas. */
export function guardFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function csvCell(value: unknown): string {
  const s = guardFormula(value === null || value === undefined ? '' : String(value));
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

export function buildCsv(problems: ExportProblemRow[], columns: ExportColumnRow[]): string {
  const custom = [...columns].sort((a, b) => a.order - b.order).map((c) => c.name);
  const header = [...EXPORT_CSV_HEADERS.map((h) => h.header), ...custom];
  const lines = [header.map(csvCell).join(',')];
  for (const p of problems) {
    const fields = readCustomFields(p.customFields);
    const values: Record<string, unknown> = {
      title: p.title,
      platform: p.platform,
      problemNumber: p.problemNumber,
      code: p.code ?? '',
      difficulty: p.difficulty,
      topic: p.topic,
      tags: p.tags.join('; '),
      url: p.url === '#' ? '' : p.url,
      dateSolved: day(p.dateSolved),
      notes: p.notes ?? '',
      status: p.status,
      currentStep: p.currentStep,
      nextRevisionAt: day(p.nextRevisionAt),
      revisionCount: p.revisionCount,
      isFavorite: p.isFavorite ? 'yes' : '',
      lists: p.lists.map((l) => l.name).join('; '),
    };
    const row = [...EXPORT_CSV_HEADERS.map((h) => values[h.field]), ...custom.map((c) => fields[c] ?? '')];
    lines.push(row.map(csvCell).join(','));
  }
  // BOM so Excel opens UTF-8 correctly
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function buildBackup(input: {
  user: { name: string | null; email: string } | null;
  preferences: Record<string, unknown>;
  columns: ExportColumnRow[];
  lists: { name: string }[];
  problems: ExportProblemRow[];
  streakLogs: { date: Date; completed: boolean }[];
  partial: boolean;
  now?: Date;
}) {
  return {
    version: BACKUP_VERSION,
    app: 'recall',
    exportedAt: (input.now ?? new Date()).toISOString(),
    partial: input.partial,
    user: input.user,
    preferences: input.preferences,
    columns: input.columns.map((c) => {
      const col = toCustomColumn(c);
      return { name: col.name, type: col.type, options: col.options, order: col.order };
    }),
    lists: input.lists.map((l) => l.name),
    totalProblems: input.problems.length,
    problems: input.problems.map((p) => ({
      platform: p.platform,
      problemNumber: p.problemNumber,
      code: p.code,
      title: p.title,
      url: p.url,
      difficulty: p.difficulty,
      topic: p.topic,
      tags: p.tags,
      dateSolved: p.dateSolved.toISOString(),
      notes: p.notes,
      customFields: readCustomFields(p.customFields),
      isFavorite: p.isFavorite,
      status: p.status,
      currentStep: p.currentStep,
      nextRevisionAt: p.nextRevisionAt.toISOString(),
      revisionCount: p.revisionCount,
      createdAt: p.createdAt.toISOString(),
      lists: p.lists.map((l) => l.name),
      revisions: p.revisions.map((r) => ({
        revisedAt: r.revisedAt.toISOString(),
        confidence: r.confidence,
        type: r.type,
        stepBefore: r.stepBefore,
        stepAfter: r.stepAfter,
      })),
    })),
    streakLogs: input.streakLogs.map((s) => ({ date: day(s.date), completed: s.completed })),
  };
}
