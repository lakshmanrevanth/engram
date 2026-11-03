// Pure form logic for the problem editor panel (kept separate so it's unit-testable).

import {
  displayCode,
  hashToProblemNumber,
  isHttpUrl,
  localDateInputToISO,
  toLocalDateInput,
} from '@/lib/platforms/problem-input';

export type ProblemPatch = Partial<{
  title: string;
  url: string;
  platform: string;
  problemNumber: number;
  code: string | null;
  difficulty: string;
  topic: string;
  tags: string[];
  dateSolved: string;
  notes: string;
  /** Move the next review to this local day (YYYY-MM-DD). */
  nextRevisionOn: string;
}>;

export type EditorForm = {
  title: string;
  url: string;
  platform: string;
  identifier: string;
  difficulty: string;
  topic: string;
  tags: string[];
  solvedOn: string;
  notes: string;
  /** '' when the problem has no next review (retired). */
  nextReviewOn: string;
};

export function toEditorForm(p: any): EditorForm {
  return {
    title: p.title ?? '',
    url: p.url ?? '',
    platform: p.platform ?? 'LEETCODE',
    identifier: p.platform === 'LEETCODE'
      ? (p.problemNumber > 0 && p.problemNumber < 100000 ? String(p.problemNumber) : '')
      : (displayCode(p) ?? ''),
    difficulty: p.difficulty ?? '',
    topic: p.topic ?? '',
    tags: Array.isArray(p.tags) ? p.tags : [],
    solvedOn: p.dateSolved ? toLocalDateInput(new Date(p.dateSolved)) : toLocalDateInput(),
    notes: p.notes ?? '',
    nextReviewOn: p.status !== 'RETIRED' && p.nextRevisionAt ? toLocalDateInput(new Date(p.nextRevisionAt)) : '',
  };
}

// Minimal PATCH body for the fields that changed, or a validation error.
export function diffEditorForm(initial: EditorForm, form: EditorForm, now: Date = new Date()): { patch: ProblemPatch } | { error: string } {
  const patch: ProblemPatch = {};
  const title = form.title.trim();
  const url = form.url.trim();
  if (!title) return { error: 'Title is required' };
  if (!isHttpUrl(url)) return { error: 'URL must start with http:// or https://' };
  if (title !== initial.title) patch.title = title;
  if (url !== initial.url) patch.url = url;

  const ident = form.identifier.trim();
  const platformChanged = form.platform !== initial.platform;
  if (platformChanged || ident !== initial.identifier) {
    if (platformChanged) patch.platform = form.platform;
    if (form.platform === 'LEETCODE') {
      if (!/^\d+$/.test(ident) || Number(ident) <= 0) return { error: 'LeetCode problem number must be a positive number' };
      patch.problemNumber = Number(ident);
      if (platformChanged) patch.code = null;
    } else {
      if (ident && (/\s/.test(ident) || ident.length > 40)) return { error: 'Code must be a short identifier like 1234A' };
      patch.code = ident ? ident.toUpperCase() : null;
      // Codeforces numbers are derived from the code server-side.
      if (form.platform !== 'CODEFORCES' || !ident) {
        patch.problemNumber = hashToProblemNumber(ident.toUpperCase() || url.replace(/\/+$/, '').toLowerCase());
      }
    }
  }
  if (form.difficulty !== initial.difficulty) patch.difficulty = form.difficulty;
  if (form.topic.trim() !== initial.topic) patch.topic = form.topic.trim();
  if (form.tags.join('\u0000') !== initial.tags.join('\u0000')) patch.tags = form.tags;
  if (form.solvedOn !== initial.solvedOn) {
    if (!form.solvedOn) return { error: 'Solve date is required' };
    if (form.solvedOn > toLocalDateInput(now)) return { error: "Solve date can't be in the future" };
    patch.dateSolved = localDateInputToISO(form.solvedOn, now);
  }
  if (form.notes !== initial.notes) patch.notes = form.notes;
  if (form.nextReviewOn !== initial.nextReviewOn) {
    if (!form.nextReviewOn) return { error: 'Next review date is required' };
    if (form.nextReviewOn < toLocalDateInput(now)) return { error: "Next review can't be in the past" };
    patch.nextRevisionOn = form.nextReviewOn;
  }
  return { patch };
}
