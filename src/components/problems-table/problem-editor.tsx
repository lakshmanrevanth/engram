'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSWRConfig } from 'swr';
import { X } from 'lucide-react';
import { DEFAULT_TOPICS, getDifficultyStyle, TableStyles } from './columns';
import { TagEditor } from './tag-input';
import { mergeSuggestions, topicsFrom, useCachedProblems } from './suggestions';
import { Pill } from '@/components/ui/pill';
import { isHttpUrl, toLocalDateInput } from '@/lib/platforms/problem-input';
import { diffEditorForm, toEditorForm, type EditorForm, type ProblemPatch } from './editor-form';

export const PLATFORM_OPTIONS = [
  { value: 'LEETCODE', label: 'LeetCode' },
  { value: 'CODEFORCES', label: 'Codeforces' },
  { value: 'GFG', label: 'GeeksForGeeks' },
  { value: 'HACKERRANK', label: 'HackerRank' },
  { value: 'CODECHEF', label: 'CodeChef' },
];

export type { ProblemPatch };

export class ProblemPatchError extends Error {
  constructor(message: string, public status: number, public existingId?: string | null) {
    super(message);
  }
}

// PATCH with an optimistic update of the '/api/problems' SWR cache. Used when the
// table doesn't pass its own handler.
export function useProblemPatch() {
  const { mutate } = useSWRConfig();
  return useCallback(async (id: string, patch: ProblemPatch) => {
    mutate('/api/problems', (prev: any[] | undefined) => prev?.map((p) => (p.id === id ? { ...p, ...patch } : p)), { revalidate: false });
    let res: Response;
    try {
      res = await fetch(`/api/problems/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch {
      mutate('/api/problems');
      throw new ProblemPatchError('Network error — changes not saved', 0);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      mutate('/api/problems');
      throw new ProblemPatchError(json.error ?? 'Failed to save changes', res.status, json.existingId);
    }
    if (json.problem) {
      // Server-computed fields (e.g. nextRevisionAt after a solve-date change).
      mutate('/api/problems', (prev: any[] | undefined) => prev?.map((p) => (p.id === id ? { ...p, ...json.problem } : p)), { revalidate: false });
    }
    if (patch.nextRevisionOn || patch.dateSolved) {
      // The problem may have moved into or out of today's queue.
      mutate((key: unknown) => typeof key === 'string' && (key.startsWith('/api/daily') || key.startsWith('/api/problems/due') || key === '/api/concepts'));
    }
  }, [mutate]);
}

type Form = EditorForm;

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-subtle)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-geist-mono), monospace',
};

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label htmlFor={htmlFor} style={labelStyle}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{hint}</span>}
    </div>
  );
}

export function ProblemEditor({
  problem,
  onClose,
  onSave,
  onJumpToProblem,
  onDelete,
}: {
  problem: any;
  onClose: () => void;
  onSave?: (id: string, patch: ProblemPatch) => Promise<void>;
  onJumpToProblem?: (id: string) => void;
  /** Deletes this problem (the table shows an Undo toast). */
  onDelete?: (id: string) => void;
}) {
  const fallbackSave = useProblemPatch();
  const save = onSave ?? fallbackSave;
  const [initial] = useState(() => toEditorForm(problem));
  const [form, setForm] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const cached = useCachedProblems();
  const topicOptions = mergeSuggestions(topicsFrom(cached), DEFAULT_TOPICS);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
    setConfirmDiscard(false);
  };

  // Focus the first field; restore focus to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => titleRef.current?.focus(), 20);
    return () => { clearTimeout(t); opener?.focus?.(); };
  }, []);

  const requestClose = () => {
    if (dirty && !confirmDiscard) { setConfirmDiscard(true); return; }
    onClose();
  };

  const handleSave = async () => {
    if (saving) return;
    const result = diffEditorForm(initial, form);
    if ('error' in result) { setError(result.error); return; }
    if (Object.keys(result.patch).length === 0) { onClose(); return; }
    setSaving(true);
    setError('');
    setDuplicateId(null);
    try {
      await save(problem.id, result.patch);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save changes');
      if (e?.status === 409 && e.existingId) setDuplicateId(e.existingId);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
      return;
    }
    if (e.key === 'Tab' && panelRef.current) {
      // Keep focus inside the dialog.
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter((el) => !el.hasAttribute('disabled'));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); handleSave(); }
  };

  const dateChanged = form.solvedOn !== initial.solvedOn;
  const isLeetCode = form.platform === 'LEETCODE';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div data-portal="true" data-problem-editor onKeyDown={handleKeyDown}>
      <TableStyles />
      <div
        aria-hidden
        onMouseDown={requestClose}
        style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 9998 }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-heading`}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(440px, 100vw)', zIndex: 9999,
          background: 'var(--popover)', borderLeft: '1px solid var(--popover-border, var(--border))',
          boxShadow: 'var(--shadow-modal)', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <h2 id={`${uid}-heading`} style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-strong)', margin: 0 }}>Edit problem</h2>
          <button type="button" className="pt-focusable" onClick={requestClose} aria-label="Close editor"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'inline-flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Title" htmlFor={`${uid}-title`}>
            <input id={`${uid}-title`} ref={titleRef} className="pt-input" value={form.title} maxLength={300}
              onChange={(e) => set('title', e.target.value)} onKeyDown={submitOnEnter} />
          </Field>
          <Field label="URL" htmlFor={`${uid}-url`}>
            <input id={`${uid}-url`} className="pt-input" type="url" value={form.url} inputMode="url"
              aria-invalid={!!form.url.trim() && !isHttpUrl(form.url)}
              onChange={(e) => set('url', e.target.value)} onKeyDown={submitOnEnter}
              style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 12 }} />
          </Field>
          {/* System design concepts are identified by their code (library slug or path
              article), which tracks learning-path progress, so it isn't editable here. */}
          {problem.platform !== 'SYSTEM_DESIGN' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Platform" htmlFor={`${uid}-platform`}>
              <select id={`${uid}-platform`} className="pt-input" value={form.platform}
                onChange={(e) => set('platform', e.target.value)} onKeyDown={submitOnEnter}>
                {PLATFORM_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            <Field label={isLeetCode ? 'Number' : 'Code'} htmlFor={`${uid}-ident`}>
              <input id={`${uid}-ident`} className="pt-input" value={form.identifier}
                inputMode={isLeetCode ? 'numeric' : 'text'}
                placeholder={isLeetCode ? 'e.g. 1' : form.platform === 'CODEFORCES' ? 'e.g. 1234A' : 'optional'}
                onChange={(e) => set('identifier', e.target.value)} onKeyDown={submitOnEnter}
                style={{ fontFamily: 'var(--font-geist-mono), monospace' }} />
            </Field>
          </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Difficulty">
              <div role="radiogroup" aria-label="Difficulty" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(['EASY', 'MEDIUM', 'HARD'] as const).map((d) => {
                  const st = getDifficultyStyle(d);
                  const on = form.difficulty === d;
                  return (
                    <button key={d} type="button" role="radio" aria-checked={on} className="pt-focusable"
                      onClick={() => set('difficulty', d)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: on ? 1 : 0.45 }}>
                      <Pill bg={st.bg} text={st.text} border={st.border}>{d.charAt(0) + d.slice(1).toLowerCase()}</Pill>
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Solved on" htmlFor={`${uid}-solved`}
              hint={dateChanged ? (problem.revisionCount > 0 ? 'Already reviewed — schedule stays as is.' : 'First review will be rescheduled from this date.') : undefined}>
              <input id={`${uid}-solved`} className="pt-input" type="date" value={form.solvedOn} max={toLocalDateInput()}
                onChange={(e) => set('solvedOn', e.target.value)} onKeyDown={submitOnEnter} />
            </Field>
            {initial.nextReviewOn && (
              <Field label={problem.status === 'MASTERED' ? 'Next recheck' : 'Next review'} htmlFor={`${uid}-next`}
                hint={form.nextReviewOn !== initial.nextReviewOn ? 'Moves the date only; no review is logged.' : undefined}>
                <input id={`${uid}-next`} className="pt-input" type="date" value={form.nextReviewOn} min={toLocalDateInput()}
                  onChange={(e) => set('nextReviewOn', e.target.value)} onKeyDown={submitOnEnter} />
              </Field>
            )}
          </div>
          <Field label="Topic" htmlFor={`${uid}-topic`} hint="Primary topic. Use tags for anything else.">
            <input id={`${uid}-topic`} className="pt-input" value={form.topic} list={`${uid}-topics`}
              onChange={(e) => set('topic', e.target.value)} onKeyDown={submitOnEnter} />
            <datalist id={`${uid}-topics`}>
              {topicOptions.map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
          <Field label="Tags" hint="Up to 10, e.g. Blind 75, revisit, interview.">
            <TagEditor tags={form.tags} onChange={(t) => set('tags', t)} onSubmit={handleSave} onEscape={requestClose} />
          </Field>
          <Field label="Notes" htmlFor={`${uid}-notes`}>
            <textarea id={`${uid}-notes`} className="pt-input" value={form.notes} rows={4}
              onChange={(e) => set('notes', e.target.value)} style={{ resize: 'vertical', lineHeight: 1.4 }} />
          </Field>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {error && (
            <div role="alert" style={{ fontSize: 12, color: 'var(--error)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{error}</span>
              {duplicateId && onJumpToProblem && (
                <button type="button" className="pt-focusable" onClick={() => { onClose(); onJumpToProblem(duplicateId); }}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-strong)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>
                  Jump to it
                </button>
              )}
            </div>
          )}
          {confirmDiscard && (
            <div role="alert" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              Discard your changes? Press Esc again or Close to discard.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
            {onDelete && (
              <button type="button" className="pt-focusable" onClick={() => { onClose(); onDelete(problem.id); }}
                aria-label={`Delete ${problem.title}`}
                style={{ background: 'none', border: '1px solid var(--error-border)', borderRadius: 6, color: 'var(--error)', cursor: 'pointer', padding: '6px 12px', fontSize: 13 }}>
                Delete
              </button>
            )}
            <span className="hidden md:inline" style={{ fontSize: 11, color: 'var(--text-faint)', marginRight: 'auto' }}>
              Enter to save · Esc to close
            </span>
            <button type="button" className="pt-focusable" onClick={requestClose}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-dim)', cursor: 'pointer', padding: '6px 12px', fontSize: 13 }}>
              {confirmDiscard ? 'Discard' : 'Cancel'}
            </button>
            <button type="button" className="pt-focusable" onClick={handleSave} disabled={saving}
              style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 6, color: 'var(--success)', cursor: saving ? 'default' : 'pointer', padding: '6px 14px', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
