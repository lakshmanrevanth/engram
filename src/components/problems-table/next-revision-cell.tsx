'use client';

// "Next revision" cell: shows when the problem is due and lets the user move that date.
// Changing the date logs no review and keeps the ladder step.

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDays, format, startOfDay } from 'date-fns';
import { toLocalDateInput } from '@/lib/platforms/problem-input';

type ScheduledProblem = { status: string; nextRevisionAt?: string | Date | null };

type Props = {
  problem: ScheduledProblem;
  /** Saves `{ nextRevisionOn: 'YYYY-MM-DD' }`; should throw on failure. */
  onSave: (nextRevisionOn: string) => Promise<void>;
};

const QUICK_PICKS: { label: string; days: number }[] = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In 1 week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
  { label: 'In 1 month', days: 30 },
];

export function describeNextRevision(problem: ScheduledProblem, now: Date = new Date()): { text: string; color: string } {
  if (problem.status === 'RETIRED' || !problem.nextRevisionAt) return { text: '—', color: 'var(--text-faint)' };
  const diffDays = Math.round(
    (startOfDay(new Date(problem.nextRevisionAt)).getTime() - startOfDay(now).getTime()) / 86400000
  );
  const prefix = problem.status === 'MASTERED' ? 'recheck ' : '';
  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, color: 'var(--error)' };
  if (diffDays === 0) return { text: problem.status === 'MASTERED' ? 'Recheck today' : 'Today', color: 'var(--medium-text)' };
  if (diffDays === 1) return { text: problem.status === 'MASTERED' ? 'Recheck tomorrow' : 'Tomorrow', color: 'var(--text-dim)' };
  return { text: `${prefix}in ${diffDays}d`, color: 'var(--text-muted)' };
}

export function NextRevisionCell({ problem, onSave }: Props) {
  const [open, setOpen] = useState(false);
  // Fixed-position coordinates: the menu is rendered in a portal so the table's
  // overflow can't clip it.
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const editable = problem.status !== 'RETIRED' && !!problem.nextRevisionAt;
  const { text, color } = describeNextRevision(problem);
  const today = toLocalDateInput();

  // Close on outside click or Escape, and return focus to the cell.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    // Keep the menu next to its cell when the page or table scrolls; close it only
    // once the cell has scrolled out of view (or the window is resized).
    const close = (e: Event) => {
      if (e.type === 'scroll' && popRef.current?.contains(e.target as Node)) return;
      const r = buttonRef.current?.getBoundingClientRect();
      if (e.type === 'resize' || !r || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
        setOpen(false);
        return;
      }
      setPos((p) => {
        if (!p) return p;
        const left = Math.max(8, Math.min(r.right - 220, window.innerWidth - 228));
        return p.top !== undefined ? { left, top: r.bottom + 4 } : { left, bottom: window.innerHeight - r.top + 4 };
      });
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    popRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const save = async (key: string) => {
    if (!key) return;
    if (key < today) {
      setError("Can't be in the past");
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(key);
      setOpen(false);
      buttonRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const label = (
    <span style={{ fontSize: 13, color, fontFamily: 'var(--font-geist-mono), monospace', fontVariantNumeric: 'tabular-nums' }}>{text}</span>
  );
  if (!editable) return label;

  const current = new Date(problem.nextRevisionAt as string | Date);
  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        className="pt-focusable"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Next review ${format(current, 'MMM d, yyyy')}. Change date`}
        title={`${format(current, 'EEE, MMM d, yyyy')} — click to change`}
        onClick={(e) => {
          e.stopPropagation();
          setCustom(toLocalDateInput(current) < today ? today : toLocalDateInput(current));
          setError('');
          const r = e.currentTarget.getBoundingClientRect();
          const MENU_W = 220;
          const MENU_H = 320;
          const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8));
          // Open upward when there isn't room below.
          setPos(
            r.bottom + 4 + MENU_H > window.innerHeight && r.top > MENU_H
              ? { left, bottom: window.innerHeight - r.top + 4 }
              : { left, top: r.bottom + 4 }
          );
          setOpen((o) => !o);
        }}
        style={{ background: 'none', border: 'none', padding: '2px 4px', margin: '0 -4px', borderRadius: 4, cursor: 'pointer' }}
      >
        {label}
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={popRef}
          id={menuId}
          role="dialog"
          aria-label="Change next review date"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            bottom: pos.bottom,
            zIndex: 1000,
            width: 220,
            background: 'var(--popover)',
            border: '1px solid var(--input-border)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-popover)',
            padding: 8,
            display: 'grid',
            gap: 2,
          }}
        >
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', padding: '2px 6px 6px' }}>
            Now {format(current, 'EEE, MMM d')} · moving it logs no review
          </div>
          {QUICK_PICKS.map((q) => {
            const day = addDays(new Date(), q.days);
            return (
              <button
                key={q.label}
                type="button"
                disabled={saving}
                onClick={() => save(toLocalDateInput(day))}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 8px',
                  fontSize: 13,
                  color: 'var(--foreground)',
                  cursor: saving ? 'default' : 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--input-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <span>{q.label}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{format(day, 'EEE MMM d')}</span>
              </button>
            );
          })}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(custom);
            }}
            style={{ display: 'flex', gap: 6, padding: '6px 2px 2px', borderTop: '1px solid var(--table-border)', marginTop: 4 }}
          >
            <label htmlFor={`${menuId}-date`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              Pick a date
            </label>
            <input
              id={`${menuId}-date`}
              type="date"
              value={custom}
              min={today}
              onChange={(e) => setCustom(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: 4,
                color: 'var(--foreground)',
                fontSize: 12.5,
                padding: '4px 6px',
              }}
            />
            <button
              type="submit"
              disabled={saving || !custom}
              style={{
                background: 'var(--foreground)',
                color: 'var(--background)',
                border: 'none',
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 600,
                padding: '4px 10px',
                cursor: 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? '…' : 'Set'}
            </button>
          </form>
          {error && (
            <div role="alert" style={{ fontSize: 12, color: 'var(--error)', padding: '4px 6px 0' }}>
              {error}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
