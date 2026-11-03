'use client';

import { useId, useRef, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { TopLevelPortal } from './columns';
import { tagsFrom, useCachedProblems } from './suggestions';
import { MAX_TAGS, MAX_TAG_LENGTH, normalizeTags } from '@/lib/platforms/problem-input';

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  background: 'var(--filter-chip-bg, var(--secondary))',
  border: '1px solid var(--filter-chip-border, var(--border))',
  color: 'var(--text-dim)',
  borderRadius: 4,
  padding: '1px 6px',
  fontSize: 11,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  maxWidth: 120,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  lineHeight: '16px',
};

export function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span style={chipStyle} title={tag}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tag}</span>
      {onRemove && (
        <button
          type="button"
          className="pt-focusable"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={`Remove tag ${tag}`}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-faint)', display: 'inline-flex' }}
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}

// Chip editor: Enter or comma adds, Backspace on empty removes the last tag.
// Enter on an empty input calls onSubmit (e.g. save the whole row).
export function TagEditor({
  tags,
  onChange,
  suggestions,
  autoFocus,
  onSubmit,
  onEscape,
  placeholder = 'Add tag…',
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  autoFocus?: boolean;
  onSubmit?: () => void;
  onEscape?: () => void;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const listId = useId();
  const cached = useCachedProblems();
  const options = (suggestions ?? tagsFrom(cached)).filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()));

  const add = (raw: string) => {
    const result = normalizeTags([...tags, raw]);
    if ('error' in result) { setError(result.error); return false; }
    setError('');
    onChange(result.tags);
    setText('');
    return true;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
        {tags.map((t) => (
          <TagChip key={t} tag={t} onRemove={() => onChange(tags.filter((x) => x !== t))} />
        ))}
        {tags.length < MAX_TAGS && (
          <input
            className="pt-input"
            value={text}
            list={listId}
            autoFocus={autoFocus}
            maxLength={MAX_TAG_LENGTH}
            aria-label="Add tag"
            aria-invalid={!!error}
            placeholder={tags.length ? '' : placeholder}
            onChange={(e) => {
              const v = e.target.value;
              if (v.endsWith(',')) add(v.slice(0, -1));
              else { setText(v); setError(''); }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (text.trim()) add(text);
                else onSubmit?.();
              } else if (e.key === 'Backspace' && !text && tags.length) {
                onChange(tags.slice(0, -1));
              } else if (e.key === 'Escape' && onEscape) {
                e.preventDefault();
                e.stopPropagation();
                onEscape();
              }
            }}
            onBlur={() => { if (text.trim()) add(text); }}
            style={{ width: 110, padding: '2px 6px', fontSize: 12 }}
          />
        )}
        <datalist id={listId}>
          {options.slice(0, 50).map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>
      {error && <span role="alert" style={{ fontSize: 11, color: 'var(--error)' }}>{error}</span>}
    </div>
  );
}

// Compact tags display for a table cell; opens a chip editor in a popover.
export function TagsCell({
  tags,
  onSave,
  suggestions,
}: {
  tags: string[];
  onSave: (tags: string[]) => Promise<void> | void;
  suggestions?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(tags);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);

  const openEditor = () => { setDraft(tags); cancelled.current = false; setOpen(true); };
  const close = async () => {
    setOpen(false);
    if (cancelled.current) return;
    if (draft.join('\u0000') !== tags.join('\u0000')) {
      try { await onSave(draft); } catch { /* parent reverts + toasts */ }
    }
  };

  const shown = tags.slice(0, 1);
  const extra = tags.length - shown.length;

  return (
    <div style={{ display: 'inline-flex', minWidth: 0 }}>
      <button
        ref={buttonRef}
        type="button"
        data-tags-cell
        className={`pt-focusable${tags.length ? '' : ' pt-reveal'}`}
        onClick={(e) => { e.stopPropagation(); if (open) close(); else openEditor(); }}
        aria-label={tags.length ? `Tags: ${tags.join(', ')}. Edit tags` : 'Add tags'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={tags.length ? tags.join(', ') : 'Add tags'}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, minWidth: 0 }}
      >
        {shown.map((t) => <TagChip key={t} tag={t} />)}
        {extra > 0 && <span style={{ ...chipStyle, maxWidth: 40 }}>+{extra}</span>}
        {tags.length === 0 && (
          <span style={{ ...chipStyle, color: 'var(--text-faint)', borderStyle: 'dashed', background: 'transparent' }}>
            <Plus size={10} /> tag
          </span>
        )}
      </button>
      {open && (
        <TopLevelPortal anchorRef={buttonRef} onClose={close} width={260} minHeight={80} label="Tags">
          <div style={{ width: 248, padding: 2 }}>
            <TagEditor
              tags={draft}
              onChange={setDraft}
              suggestions={suggestions}
              autoFocus
              onSubmit={() => { close(); buttonRef.current?.focus(); }}
              onEscape={() => { cancelled.current = true; setOpen(false); buttonRef.current?.focus(); }}
            />
            <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 6 }}>
              Enter to add · Enter on empty to save · Esc to cancel
            </div>
          </div>
        </TopLevelPortal>
      )}
    </div>
  );
}
