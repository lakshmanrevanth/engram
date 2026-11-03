'use client';

// Renders and edits one custom-column value according to the column's type.
// Usage (row.tsx): <CustomCell column={col} value={fields[col.name]} onSave={(v) => onCustomFieldSave(problem.id, col.name, v)} />

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import { CustomCheckbox } from '@/components/ui/custom-checkbox';
import {
  formatCustomValue,
  isChecked,
  parseCustomValue,
  toCustomColumn,
  type CustomColumn,
} from '@/lib/custom-columns';

type ColumnLike = { id: string; name: string; type?: string | null; options?: unknown; order?: number };

export type CustomCellProps = {
  column: ColumnLike;
  value: string | undefined | null;
  onSave: (value: string) => Promise<void> | void;
  /** Cell width in px (used for truncation). */
  width?: number;
};

const baseDisplay = {
  fontSize: 13,
  color: 'var(--text-muted)',
  minHeight: 26,
  padding: '3px 6px',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  boxSizing: 'border-box',
  background: 'transparent',
  border: 'none',
  textAlign: 'left',
  font: 'inherit',
  cursor: 'text',
} as const;

const inputStyle = (invalid: boolean) =>
  ({
    width: '100%',
    background: 'var(--input-bg)',
    border: `1px solid ${invalid ? 'var(--destructive)' : 'var(--input-border)'}`,
    borderRadius: 4,
    color: 'var(--foreground)',
    fontSize: 13,
    padding: '3px 6px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    colorScheme: 'light dark',
  }) as const;

export function CustomCell({ column: rawColumn, value, onSave, width = 140 }: CustomCellProps) {
  const column: CustomColumn = toCustomColumn({ order: 0, ...rawColumn });
  const stored = value ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stored);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayRef = useRef<HTMLButtonElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }
  }, [editing]);

  const save = async (raw: string) => {
    const parsed = parseCustomValue(column, raw);
    if (!parsed.ok) {
      setError(parsed.error);
      return false;
    }
    setError(null);
    if (parsed.value === stored) return true;
    setSaving(true);
    try {
      await onSave(parsed.value);
      return true;
    } catch {
      setDraft(stored);
      return true; // caller already shows a toast; leave edit mode
    } finally {
      setSaving(false);
    }
  };

  const commit = async () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    if (await save(draft)) {
      setEditing(false);
      setTimeout(() => displayRef.current?.focus(), 0);
    }
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelledRef.current = true;
      setDraft(stored);
      setError(null);
      setEditing(false);
      setTimeout(() => {
        cancelledRef.current = false;
        displayRef.current?.focus();
      }, 0);
    }
  };

  const label = `${column.name}: ${formatCustomValue(column, stored) || 'empty'}`;

  // Checkbox — toggles in place
  if (column.type === 'checkbox') {
    const checked = isChecked(stored);
    return (
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 26, padding: '0 6px', opacity: saving ? 0.6 : 1 }}>
        <CustomCheckbox
          checked={checked}
          ariaLabel={column.name}
          disabled={saving}
          onChange={(e) => {
            e.stopPropagation();
            save(checked ? '' : 'true');
          }}
        />
      </div>
    );
  }

  // Select — native select is keyboard accessible out of the box
  if (column.type === 'select') {
    const known = column.options.some((o) => o === stored);
    return (
      <select
        aria-label={column.name}
        value={stored}
        disabled={saving}
        onChange={(e) => save(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        title={stored || undefined}
        style={{
          ...baseDisplay,
          cursor: 'pointer',
          opacity: saving ? 0.6 : 1,
          maxWidth: width,
          color: stored ? 'var(--text-muted)' : 'var(--text-faint)',
          appearance: 'none',
          WebkitAppearance: 'none',
          backgroundColor: hovered ? 'var(--table-inline-edit-hover)' : 'transparent',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <option value="">—</option>
        {!known && stored && <option value={stored}>{stored}</option>}
        {column.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  // Text / date / url — click or Enter to edit inline
  if (editing) {
    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          ref={inputRef}
          type={column.type === 'date' ? 'date' : column.type === 'url' ? 'url' : 'text'}
          aria-label={column.name}
          aria-invalid={!!error}
          aria-describedby={error ? `cc-err-${column.id}` : undefined}
          value={draft}
          disabled={saving}
          placeholder={column.type === 'url' ? 'https://' : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onInputKeyDown}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
          style={inputStyle(!!error)}
        />
        {error && (
          <div
            id={`cc-err-${column.id}`}
            role="alert"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 2,
              zIndex: 100,
              fontSize: 11.5,
              whiteSpace: 'nowrap',
              padding: '3px 6px',
              borderRadius: 4,
              background: 'var(--error-bg)',
              border: '1px solid var(--error-border)',
              color: 'var(--error)',
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  const display = formatCustomValue(column, stored);
  const startEditing = () => {
    setDraft(stored);
    setError(null);
    setEditing(true);
  };

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {column.type === 'url' && stored ? (
        <a
          href={stored}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={stored}
          style={{
            ...baseDisplay,
            cursor: 'pointer',
            color: 'var(--text-muted)',
            textDecoration: 'underline',
            textUnderlineOffset: 2,
            overflow: 'hidden',
            minWidth: 0,
            flex: 1,
            gap: 4,
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</span>
          <ExternalLink size={11} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-faint)' }} />
        </a>
      ) : null}

      <button
        ref={displayRef}
        type="button"
        aria-label={column.type === 'url' && stored ? `Edit ${column.name} link` : `Edit ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          startEditing();
        }}
        title={column.type === 'url' && stored ? 'Edit link' : display || undefined}
        style={{
          ...baseDisplay,
          width: column.type === 'url' && stored ? 'auto' : '100%',
          flexShrink: column.type === 'url' && stored ? 0 : 1,
          background: hovered ? 'var(--table-inline-edit-hover)' : 'transparent',
          opacity: saving ? 0.6 : 1,
          transition: 'background 0.15s ease, opacity 0.15s ease',
          justifyContent: 'space-between',
          minWidth: 0,
        }}
      >
        {!(column.type === 'url' && stored) && (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, maxWidth: width - 24 }}>
            {display}
          </span>
        )}
        {(hovered || (column.type === 'url' && stored)) && (
          <Pencil size={12} aria-hidden="true" style={{ color: 'var(--text-faint)', flexShrink: 0, marginLeft: 4, opacity: hovered ? 1 : 0 }} />
        )}
      </button>
    </div>
  );
}
