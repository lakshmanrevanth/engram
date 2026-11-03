'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { TopLevelPortal, DifficultyPickerCell, TopicPickerCell, TableStyles } from './columns';
import { TagEditor } from './tag-input';
import { PLATFORM_OPTIONS } from './problem-editor';
import { findDuplicate, lookupProblem, manualPrefill, type LookupData } from './lookup';
import { useCachedProblems } from './suggestions';
import { PlatformLogo } from '@/lib/platforms/logos';
import { isHttpUrl, localDateInputToISO, toLocalDateInput } from '@/lib/platforms/problem-input';
import { Pencil, Search, X, Loader2, ChevronDown } from 'lucide-react';

export type NewProblemPayload = {
  platform: string;
  problemNumber: number;
  title: string;
  difficulty: string;
  topic: string;
  url: string;
  code?: string;
  notes?: string;
  customFields?: Record<string, string>;
  tags?: string[];
  dateSolved: string;
};

type NewRowProps = {
  /** Should throw on failure. For duplicates, attach `status: 409` and `existingId` to the error. */
  onSave: (data: NewProblemPayload) => Promise<void>;
  onCancel: () => void;
  columns: any[];
  /** Scroll to + highlight an existing row ("Already tracked — jump to row"). */
  onJumpToProblem?: (id: string) => void;
  /** Overrides the user's default platform from settings. */
  defaultPlatform?: string;
};

type Draft = {
  manual: boolean;
  title: string;
  url: string;
  difficulty: string;
  topic: string;
  tags: string[];
  solvedOn: string;
  notes: string;
  customFields: Record<string, string>;
  problemNumber?: number;
  code?: string;
};

const PLACEHOLDERS: Record<string, string> = {
  LEETCODE: 'Problem # or URL (e.g. 1)',
  CODEFORCES: 'Code or URL (e.g. 4A)',
  CODECHEF: 'Code or URL (e.g. FLOW001)',
  GFG: 'Paste GFG problem URL',
  HACKERRANK: 'Paste HackerRank URL',
};

const mono = 'var(--font-geist-mono), monospace';
const kbd: React.CSSProperties = { background: 'var(--kbd-bg)', border: '1px solid var(--kbd-border)', borderRadius: 3, padding: '1px 5px', fontSize: 10, color: 'var(--kbd-color)' };
const primaryBtn: React.CSSProperties = {
  background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 4,
  color: 'var(--success)', cursor: 'pointer', padding: '4px 12px', fontSize: 12, fontWeight: 600,
  display: 'inline-flex', alignItems: 'center', gap: 4,
};
const ghostBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-dim)',
  cursor: 'pointer', padding: '4px 10px', fontSize: 12,
};
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, color: 'var(--text-strong)', textDecoration: 'underline',
  cursor: 'pointer', fontSize: 12,
};
const fieldLabel: React.CSSProperties = { fontSize: 10, color: 'var(--text-subtle)', letterSpacing: '0.05em', textTransform: 'uppercase' };

// ---------------------------------------------------------------------------
// Floating notes / text cell
// ---------------------------------------------------------------------------
function NewRowFloatingCell({
  value,
  placeholder,
  maxWidth = 180,
  onChange,
  onSaveRow,
}: {
  value: string;
  placeholder: string;
  maxWidth?: number;
  onChange: (val: string) => void;
  onSaveRow: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setEditing(false);
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 10);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClickOutside); };
  }, [editing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); setEditing(false); onSaveRow();
    } else if (e.key === 'Escape') {
      e.preventDefault(); setEditing(false); displayRef.current?.focus();
    }
  };

  const displayText = value.trim();
  const truncated = displayText.length > 40 ? displayText.slice(0, 40) + '…' : displayText;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={displayRef}
        role="button"
        tabIndex={0}
        className="pt-focusable"
        aria-label={displayText ? `${placeholder}: ${displayText}` : placeholder}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); e.stopPropagation(); setEditing(true); } }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={displayText || undefined}
        style={{
          fontSize: 13, color: displayText ? 'var(--text-muted)' : 'var(--text-faint)', cursor: 'text',
          minHeight: 26, padding: '3px 6px', borderRadius: 4,
          background: hovered ? 'var(--table-inline-edit-hover)' : 'transparent',
          transition: 'background 0.15s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', boxSizing: 'border-box',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, maxWidth: maxWidth - 24 }}>
          {truncated || placeholder}
        </span>
        {hovered && <Pencil size={12} style={{ color: 'var(--text-faint)', flexShrink: 0, marginLeft: 4 }} />}
      </div>
      {editing && (
        <div
          ref={containerRef}
          data-floating-editor
          style={{
            position: 'absolute', top: -4, left: -4,
            width: 'max(100% + 8px, 240px)', zIndex: 100,
            background: 'var(--popover)', border: '1px solid var(--popover-border)',
            borderRadius: 6, padding: '8px 10px',
            boxShadow: 'var(--shadow-modal)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            aria-label={placeholder}
            onChange={(e) => {
              onChange(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={placeholder}
            style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-strong)', fontSize: 13, fontFamily: 'inherit', lineHeight: '1.4',
              resize: 'none', overflow: 'hidden', padding: 0, margin: 0,
              display: 'block', boxSizing: 'border-box', caretColor: 'var(--text-strong)',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main NewRow component: lookup → editable draft → explicit save
// ---------------------------------------------------------------------------
export function NewRow({ onSave, onCancel, columns, onJumpToProblem, defaultPlatform }: NewRowProps) {
  const [platform, setPlatform] = useState(defaultPlatform ?? 'LEETCODE');
  const platformTouched = useRef(!!defaultPlatform);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [lookup, setLookup] = useState<{ state: 'idle' | 'loading' | 'not_found' | 'error'; message?: string }>({ state: 'idle' });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState<{ id: string; title?: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const cached = useCachedProblems();

  const queryRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const platformBtnRef = useRef<HTMLButtonElement>(null);
  const live = useRef({ draft, dirty, confirmDiscard });
  useEffect(() => { live.current = { draft, dirty, confirmDiscard }; }, [draft, dirty, confirmDiscard]);

  // Default platform from the user's settings (unless they already picked one).
  useEffect(() => {
    if (defaultPlatform) return;
    let alive = true;
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const p = json?.preferences?.defaultPlatform;
        if (alive && !platformTouched.current && PLATFORM_OPTIONS.some((o) => o.value === p)) setPlatform(p);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [defaultPlatform]);

  useEffect(() => {
    const t = setTimeout(() => queryRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, []);

  // Esc: close an open discard prompt / cancel. Pickers and the notes editor handle their own Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[data-portal="true"]')) return;
      if ((e.target as HTMLElement | null)?.closest?.('[data-floating-editor]')) return;
      e.preventDefault();
      const { draft: d, dirty: isDirty, confirmDiscard: confirming } = live.current;
      if (d && isDirty && !confirming) { setConfirmDiscard(true); return; }
      onCancel();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const choosePlatform = (p: string) => {
    platformTouched.current = true;
    setPlatform(p);
    setPlatformOpen(false);
    setDraft(null);
    setLookup({ state: 'idle' });
    setDuplicate(null);
    setError('');
    setTimeout(() => queryRef.current?.focus(), 20);
  };

  const startDraft = (data: LookupData | null) => {
    const pre = manualPrefill(platform, query);
    const d: Draft = {
      manual: !data,
      title: data?.title ?? '',
      url: data?.url ?? pre.url,
      difficulty: data?.difficulty ?? '',
      topic: data?.topic ?? '',
      tags: [],
      solvedOn: toLocalDateInput(),
      notes: '',
      customFields: {},
      problemNumber: data?.problemNumber ?? pre.problemNumber,
      code: data?.code ?? (platform !== 'LEETCODE' ? pre.code : undefined),
    };
    setDraft(d);
    setDirty(false);
    setError('');
    setConfirmDiscard(false);
    setLookup({ state: 'idle' });
    setDuplicate(findDuplicate(cached, platform, d));
    setTimeout(() => titleRef.current?.focus(), 20);
  };

  const doLookup = async () => {
    const q = query.trim();
    if (!q || lookup.state === 'loading') return;
    setLookup({ state: 'loading' });
    setError('');
    const r = await lookupProblem(platform, q);
    if (r.status === 'found') startDraft(r.data);
    else if (r.status === 'not_found') setLookup({ state: 'not_found' });
    else setLookup({ state: 'error', message: r.message });
  };

  const patchDraft = useCallback((p: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...p } : d));
    setDirty(true);
    setError('');
    setConfirmDiscard(false);
  }, []);

  const backToLookup = () => {
    setDraft(null);
    setDuplicate(null);
    setError('');
    setTimeout(() => queryRef.current?.focus(), 20);
  };

  const jumpTo = (id: string) => {
    if (onJumpToProblem) onJumpToProblem(id);
    else {
      const el = document.getElementById(`problem-row-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.querySelector<HTMLElement>('[data-edit-problem]')?.focus({ preventScroll: true });
    }
    onCancel();
  };

  const handleSave = async () => {
    if (!draft || saving) return;
    const title = draft.title.trim();
    const url = draft.url.trim();
    const fail = (msg: string) => setError(msg);
    if (!title) return fail('Title is required.');
    if (!isHttpUrl(url)) return fail('Enter the problem URL (http:// or https://).');
    if (!draft.difficulty) return fail('Pick a difficulty.');
    if (!draft.solvedOn || draft.solvedOn > toLocalDateInput()) return fail("Solve date can't be in the future.");

    const custom = Object.fromEntries(Object.entries(draft.customFields).filter(([, v]) => v.trim()));
    setSaving(true);
    setError('');
    try {
      await onSave({
        platform,
        problemNumber: draft.problemNumber ?? 0,
        code: draft.code,
        title,
        difficulty: draft.difficulty,
        topic: draft.topic.trim(),
        url,
        notes: draft.notes.trim() || undefined,
        customFields: Object.keys(custom).length ? custom : undefined,
        tags: draft.tags,
        dateSolved: localDateInputToISO(draft.solvedOn),
      });
    } catch (e: any) {
      const msg: string = e?.message ?? 'Failed to save problem';
      if (e?.status === 409 || /already/i.test(msg)) {
        const id = e?.existingId ?? findDuplicate(cached, platform, draft)?.id;
        if (id) setDuplicate({ id });
        else setError('Already tracked.');
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const onEnterSave = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
  };

  const colSpan = 10 + columns.length;
  const subRowStyle: React.CSSProperties = {
    background: 'var(--new-row-bg)', borderBottom: '1px solid var(--table-border)', borderLeft: '1px solid var(--new-row-border-left)',
  };
  const platformLabel = PLATFORM_OPTIONS.find((p) => p.value === platform)?.label ?? platform;
  const identLabel = draft?.code ?? (draft?.problemNumber && draft.problemNumber < 100000 ? String(draft.problemNumber) : null);

  return (
    <>
      <tr data-new-row="true" aria-label="New problem" style={{
        background: 'var(--new-row-bg)',
        borderBottom: '1px solid var(--table-border)',
        borderLeft: '1px solid var(--new-row-border-left)',
        height: 44,
      }}>
        {/* Checkbox */}
        <td data-cell="checkbox" style={{ width: 36, textAlign: 'center', padding: '0 4px' }}>
          <TableStyles />
        </td>

        {/* Platform selector */}
        <td data-cell="platform" style={{ width: 40, textAlign: 'center', padding: '0 4px' }}>
          <button
            ref={platformBtnRef}
            type="button"
            data-platform-select-btn
            className="pt-focusable"
            onClick={() => setPlatformOpen((o) => !o)}
            aria-label={`Platform: ${platformLabel}. Change platform`}
            aria-haspopup="listbox"
            aria-expanded={platformOpen}
            title="Change platform"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 1 }}
          >
            <PlatformLogo platform={platform} />
            <ChevronDown size={10} style={{ color: 'var(--text-faint)' }} />
          </button>
          {platformOpen && (
            <TopLevelPortal anchorRef={platformBtnRef} onClose={() => setPlatformOpen(false)} width={165} label="Platform">
              <div role="listbox" aria-label="Platform" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {PLATFORM_OPTIONS.map((p, i) => (
                  <button
                    key={p.value}
                    type="button"
                    data-option
                    role="option"
                    aria-selected={p.value === platform}
                    className="pt-focusable"
                    autoFocus={p.value === platform || (i === 0 && !PLATFORM_OPTIONS.some((o) => o.value === platform))}
                    onClick={() => choosePlatform(p.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none',
                      cursor: 'pointer', padding: '6px 8px', borderRadius: 4, color: 'var(--text-normal)', fontSize: 13, textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--dropdown-item-hover-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <PlatformLogo platform={p.value} size={20} />
                    {p.label}
                  </button>
                ))}
              </div>
            </TopLevelPortal>
          )}
        </td>

        {/* Lookup input, or the editable title once we have a draft */}
        <td data-cell="problem" style={{ width: 340, padding: '0 16px' }}>
          {!draft ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <div style={{
                display: 'flex', alignItems: 'center', flex: 1, background: 'var(--input-bg)',
                border: '1px solid var(--new-row-input-border)', borderRadius: 6, padding: '0 8px', height: 30,
              }}>
                <input
                  ref={queryRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); if (lookup.state !== 'loading') setLookup({ state: 'idle' }); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doLookup(); } }}
                  placeholder={PLACEHOLDERS[platform] ?? 'Problem URL'}
                  aria-label={`${platformLabel} problem number, code or URL`}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-strong)', fontFamily: mono, fontSize: 13,
                    outline: 'none', width: '100%', padding: 0, caretColor: 'var(--text-strong)',
                  }}
                />
                {lookup.state === 'loading' ? (
                  <span role="status" aria-label="Looking up" style={{ color: 'var(--text-dim)', display: 'inline-flex', marginLeft: 4 }}>
                    <Loader2 size={13} className="animate-spin" />
                  </span>
                ) : query.trim() ? (
                  <button
                    type="button"
                    onClick={doLookup}
                    data-new-row-submit
                    className="pt-focusable"
                    title="Look up problem"
                    aria-label="Look up problem"
                    style={{
                      background: 'var(--new-row-submit-bg)', border: '1px solid var(--new-row-submit-border)', borderRadius: 4,
                      color: 'var(--success)', cursor: 'pointer', padding: '3px 6px', display: 'inline-flex', marginLeft: 4, flexShrink: 0,
                    }}
                  >
                    <Search size={12} strokeWidth={2.5} />
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onCancel}
                data-new-row-cancel
                className="pt-focusable"
                title="Cancel"
                aria-label="Cancel adding a problem"
                style={{
                  background: 'var(--new-row-cancel-bg)', border: '1px solid var(--new-row-cancel-border)', borderRadius: 6,
                  color: 'var(--new-row-cancel-color)', cursor: 'pointer', width: 30, height: 30,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {identLabel && (
                <span style={{ fontFamily: mono, fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{identLabel}</span>
              )}
              <input
                ref={titleRef}
                className="pt-input"
                value={draft.title}
                onChange={(e) => patchDraft({ title: e.target.value })}
                onKeyDown={onEnterSave}
                placeholder="Problem title"
                aria-label="Title"
                aria-invalid={!!error && !draft.title.trim()}
                maxLength={300}
                style={{ flex: 1, minWidth: 0, fontWeight: 500, padding: '4px 8px' }}
              />
            </div>
          )}
        </td>

        {/* Difficulty */}
        <td data-cell="difficulty" style={{ width: 115, padding: '0 12px', position: 'relative' }}>
          {draft && <DifficultyPickerCell difficulty={draft.difficulty} onSave={(d) => patchDraft({ difficulty: d })} />}
        </td>

        {/* Topic */}
        <td data-cell="topic" style={{ width: 185, padding: '0 12px', position: 'relative' }}>
          {draft && <TopicPickerCell topic={draft.topic} onSave={(t) => patchDraft({ topic: t })} />}
        </td>

        {/* Status */}
        <td style={{ width: 140, padding: '0 12px', color: 'var(--text-subtle)', fontSize: 13, fontFamily: mono }}>—</td>
        {/* Star */}
        <td data-col="star" style={{ width: 44, textAlign: 'center' }} />
        {/* Next Revision */}
        <td data-col="next-revision" style={{ width: 140, padding: '0 12px', color: 'var(--text-subtle)', fontSize: 13, fontFamily: mono }}>—</td>

        {/* Notes */}
        <td data-col="notes" style={{ width: 190, padding: '0 12px', position: 'relative' }}>
          {draft && (
            <NewRowFloatingCell
              value={draft.notes}
              placeholder="Notes (optional)"
              maxWidth={190}
              onChange={(val) => patchDraft({ notes: val })}
              onSaveRow={handleSave}
            />
          )}
        </td>

        {/* Custom columns */}
        {columns.map((col) => (
          <td key={col.id} data-col="custom" style={{ width: 140, padding: '0 8px', position: 'relative' }}>
            {draft && (
              <NewRowFloatingCell
                value={draft.customFields[col.name] ?? ''}
                placeholder={col.name}
                maxWidth={140}
                onChange={(val) => patchDraft({ customFields: { ...draft.customFields, [col.name]: val } })}
                onSaveRow={handleSave}
              />
            )}
          </td>
        ))}

        <td data-col="custom" style={{ width: 100 }} />
      </tr>

      {/* Lookup missed or failed → manual fallback */}
      {!draft && (lookup.state === 'not_found' || lookup.state === 'error') && (
        <tr data-new-row="true" style={subRowStyle}>
          <td colSpan={colSpan} style={{ padding: '8px 16px 8px 68px' }}>
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
              <span style={{ color: lookup.state === 'error' ? 'var(--error)' : 'var(--text-dim)' }}>
                {lookup.state === 'error'
                  ? lookup.message
                  : `Couldn't find "${query.trim()}" on ${platformLabel} — enter details manually.`}
              </span>
              <button type="button" className="pt-focusable" style={primaryBtn} onClick={() => startDraft(null)}>
                Enter details manually
              </button>
              {lookup.state === 'error' && (
                <button type="button" className="pt-focusable" style={ghostBtn} onClick={doLookup}>Retry</button>
              )}
            </div>
          </td>
        </tr>
      )}

      {/* Lookup hint with a manual escape hatch */}
      {!draft && lookup.state === 'idle' && (
        <tr data-new-row="true" style={subRowStyle}>
          <td colSpan={colSpan} style={{ padding: '4px 16px 6px 68px' }}>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              <span className="hidden md:inline"><kbd style={kbd}>Enter</kbd> to look up · <kbd style={kbd}>Esc</kbd> to cancel · </span>
              <button type="button" className="pt-focusable" style={{ ...linkBtn, fontSize: 11, color: 'var(--text-dim)' }} onClick={() => startDraft(null)}>
                Add without lookup
              </button>
            </span>
          </td>
        </tr>
      )}

      {/* Draft details: URL, solve date, tags, save */}
      {draft && (
        <tr data-new-row="true" style={subRowStyle}>
          <td colSpan={colSpan} style={{ padding: '8px 16px 10px 68px' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={fieldLabel}>URL</span>
                <input
                  className="pt-input"
                  type="url"
                  inputMode="url"
                  value={draft.url}
                  onChange={(e) => patchDraft({ url: e.target.value })}
                  onKeyDown={onEnterSave}
                  placeholder={`${platformLabel} problem URL`}
                  aria-invalid={!!draft.url.trim() && !isHttpUrl(draft.url)}
                  style={{ width: 280, maxWidth: '70vw', fontFamily: mono, fontSize: 12, padding: '4px 8px' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={fieldLabel}>Solved on</span>
                <input
                  className="pt-input"
                  type="date"
                  value={draft.solvedOn}
                  max={toLocalDateInput()}
                  onChange={(e) => patchDraft({ solvedOn: e.target.value })}
                  onKeyDown={onEnterSave}
                  style={{ fontSize: 12, padding: '3px 8px' }}
                />
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 180 }}>
                <span style={fieldLabel} id="new-row-tags-label">Tags</span>
                <TagEditor tags={draft.tags} onChange={(t) => patchDraft({ tags: t })} onSubmit={handleSave} placeholder="e.g. Blind 75" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-end', marginLeft: 'auto' }}>
                <button type="button" className="pt-focusable" style={ghostBtn} onClick={draft.manual ? backToLookup : onCancel}>
                  {draft.manual ? 'Back' : 'Cancel'}
                </button>
                <button type="button" className="pt-focusable" style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap', minHeight: 16 }}>
              <span className="hidden md:inline" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                <kbd style={kbd}>Enter</kbd> to save · <kbd style={kbd}>Esc</kbd> to cancel
                {draft.manual ? ' · manual entry' : ''}
              </span>
              {duplicate && (
                <span role="alert" style={{ fontSize: 12, color: 'var(--medium-text)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  Already tracked{duplicate.title ? ` as "${duplicate.title}"` : ''} —
                  <button type="button" className="pt-focusable" style={linkBtn} onClick={() => jumpTo(duplicate.id)}>jump to row</button>
                </span>
              )}
              {error && <span role="alert" style={{ fontSize: 12, color: 'var(--error)' }}>{error}</span>}
              {confirmDiscard && (
                <span role="alert" style={{ fontSize: 12, color: 'var(--text-dim)', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  Discard draft?
                  <button type="button" className="pt-focusable" style={linkBtn} onClick={onCancel}>Discard</button>
                  <button type="button" className="pt-focusable" style={linkBtn} onClick={() => setConfirmDiscard(false)}>Keep editing</button>
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
