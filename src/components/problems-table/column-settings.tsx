'use client';

// Dialog for managing custom columns: add (with type), rename, reorder, change type/options, delete.
// Usage: <ColumnSettings open={open} onClose={() => setOpen(false)} onChanged={() => mutateProblems()} />

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import useSWR from 'swr';
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, X } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import {
  COLUMN_TYPES,
  COLUMN_TYPE_LABELS,
  MAX_COLUMN_NAME_LENGTH,
  MAX_COLUMNS,
  toCustomColumn,
  validateColumnName,
  normalizeOptions,
  type ColumnType,
  type CustomColumn,
} from '@/lib/custom-columns';

export type ColumnSettingsProps = {
  open: boolean;
  onClose: () => void;
  /** Called after any change that can affect problems' customFields (rename, delete) or column layout. */
  onChanged?: () => void;
};

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const field = {
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  borderRadius: 4,
  color: 'var(--foreground)',
  fontSize: 12.5,
  padding: '5px 8px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
} as const;

const iconBtn = (disabled = false) =>
  ({
    background: 'none',
    border: '1px solid var(--input-border)',
    borderRadius: 4,
    color: disabled ? 'var(--text-faint)' : 'var(--text-normal)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  }) as const;

const primaryBtn = {
  background: 'var(--primary)',
  border: 'none',
  borderRadius: 6,
  color: 'var(--primary-foreground)',
  fontSize: 12.5,
  fontWeight: 500,
  padding: '5px 12px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
} as const;

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function ColumnRow({
  column,
  index,
  total,
  all,
  busy,
  onPatch,
  onDelete,
}: {
  column: CustomColumn;
  index: number;
  total: number;
  all: CustomColumn[];
  busy: boolean;
  onPatch: (id: string, body: Record<string, unknown>, label: string) => Promise<boolean>;
  onDelete: (column: CustomColumn) => Promise<void>;
}) {
  const [name, setName] = useState(column.name);
  const [options, setOptions] = useState(column.options.join(', '));
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Re-sync drafts when the saved column changes (derived-state pattern, no effect).
  const savedKey = `${column.name}\n${column.options.join('\n')}`;
  const [lastSaved, setLastSaved] = useState(savedKey);
  if (savedKey !== lastSaved) {
    setLastSaved(savedKey);
    setName(column.name);
    setOptions(column.options.join(', '));
  }

  useEffect(() => {
    if (confirmDelete) cancelRef.current?.focus();
  }, [confirmDelete]);

  const commitName = async () => {
    const v = validateColumnName(name, all, column.id);
    if (!v.ok) {
      setNameError(v.error);
      return;
    }
    setNameError(null);
    if (v.value === column.name) {
      setName(column.name);
      return;
    }
    const ok = await onPatch(column.id, { name: v.value }, `Renamed to ${v.value}`);
    if (!ok) setName(column.name);
  };

  const commitOptions = async () => {
    const parsed = normalizeOptions(options);
    if (!parsed.ok) {
      setNameError(parsed.error);
      return;
    }
    if (parsed.value.join('\n') === column.options.join('\n')) return;
    await onPatch(column.id, { options: parsed.value }, 'Options saved');
  };

  const nameId = `col-name-${column.id}`;
  return (
    <li
      style={{
        listStyle: 'none',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '10px 12px',
        background: 'var(--card)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <label htmlFor={nameId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          Column name
        </label>
        <input
          id={nameId}
          value={name}
          maxLength={MAX_COLUMN_NAME_LENGTH}
          disabled={busy}
          aria-invalid={!!nameError}
          aria-describedby={nameError ? `${nameId}-err` : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(null);
          }}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitName();
            } else if (e.key === 'Escape' && name !== column.name) {
              e.stopPropagation();
              setName(column.name);
              setNameError(null);
            }
          }}
          style={{ ...field, flex: 1, minWidth: 120, borderColor: nameError ? 'var(--destructive)' : 'var(--input-border)' }}
        />
        <select
          aria-label={`Type of ${column.name}`}
          value={column.type}
          disabled={busy}
          onChange={(e) => onPatch(column.id, { type: e.target.value }, `Type changed to ${COLUMN_TYPE_LABELS[e.target.value as ColumnType]}`)}
          style={{ ...field, width: 110, cursor: 'pointer' }}
        >
          {COLUMN_TYPES.map((t) => (
            <option key={t} value={t}>
              {COLUMN_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={`Move ${column.name} up`}
          disabled={busy || index === 0}
          onClick={() => onPatch(column.id, { order: index - 1 }, `${column.name} moved up`)}
          style={iconBtn(busy || index === 0)}
        >
          <ArrowUp size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Move ${column.name} down`}
          disabled={busy || index === total - 1}
          onClick={() => onPatch(column.id, { order: index + 1 }, `${column.name} moved down`)}
          style={iconBtn(busy || index === total - 1)}
        >
          <ArrowDown size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Delete ${column.name}`}
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
          style={{ ...iconBtn(busy), color: busy ? 'var(--text-faint)' : 'var(--destructive)' }}
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>

      {nameError && (
        <div id={`${nameId}-err`} role="alert" style={{ fontSize: 11.5, color: 'var(--error)' }}>
          {nameError}
        </div>
      )}

      {column.type === 'select' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor={`${nameId}-opts`} style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
            Options (comma separated)
          </label>
          <input
            id={`${nameId}-opts`}
            value={options}
            disabled={busy}
            placeholder="e.g. Todo, Revisit, Done"
            onChange={(e) => setOptions(e.target.value)}
            onBlur={commitOptions}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitOptions();
              }
            }}
            style={{ ...field, width: '100%' }}
          />
        </div>
      )}

      {confirmDelete && (
        <div
          role="alertdialog"
          aria-labelledby={`${nameId}-del`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
            padding: '8px 10px',
            borderRadius: 4,
            background: 'var(--error-bg)',
            border: '1px solid var(--error-border)',
          }}
        >
          <span id={`${nameId}-del`} style={{ fontSize: 12, color: 'var(--error)' }}>
            Delete &quot;{column.name}&quot; and its values from every problem? This can&apos;t be undone.
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button ref={cancelRef} type="button" onClick={() => setConfirmDelete(false)} style={{ ...iconBtn(), padding: '4px 10px', fontSize: 12 }}>
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await onDelete(column);
                setConfirmDelete(false);
              }}
              style={{ ...primaryBtn, background: 'var(--destructive)', color: '#fff', padding: '4px 10px', fontSize: 12 }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function ColumnSettings({ open, onClose, onChanged }: ColumnSettingsProps) {
  const { data, mutate } = useSWR(open ? '/api/columns' : null, fetcher);
  const columns: CustomColumn[] = Array.isArray(data)
    ? data.map(toCustomColumn).sort((a, b) => a.order - b.order)
    : [];

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ColumnType>('text');
  const [newOptions, setNewOptions] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Clear messages each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setError(null);
      setStatus('');
    }
  }

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => nameInputRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await mutate();
      setStatus(label);
      onChanged?.();
      return true;
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
      await mutate();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onPatch = (id: string, body: Record<string, unknown>, label: string) =>
    run(label, () => send(`/api/columns/${encodeURIComponent(id)}`, 'PATCH', body));

  const onDelete = async (column: CustomColumn) => {
    await run(`Deleted ${column.name}`, () => send(`/api/columns/${encodeURIComponent(column.id)}`, 'DELETE'));
  };

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    const v = validateColumnName(newName, columns);
    if (!v.ok) {
      setError(v.error);
      nameInputRef.current?.focus();
      return;
    }
    const opts = normalizeOptions(newOptions);
    if (!opts.ok) {
      setError(opts.error);
      return;
    }
    const ok = await run(`Added ${v.value}`, () =>
      send('/api/columns', 'POST', { name: v.value, type: newType, options: newType === 'select' ? opts.value : undefined })
    );
    if (ok) {
      setNewName('');
      setNewOptions('');
      setNewType('text');
      nameInputRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'var(--overlay)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="column-settings-title"
        onKeyDown={onKeyDown}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--popover)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: 'var(--shadow-modal)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2 id="column-settings-title" style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            Custom columns
          </h2>
          <button type="button" aria-label="Close column settings" onClick={onClose} style={{ ...iconBtn(), border: 'none' }}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {busy ? 'Saving' : status}
          </div>

          {error && (
            <div
              role="alert"
              style={{
                fontSize: 12.5,
                color: 'var(--error)',
                padding: '6px 10px',
                borderRadius: 4,
                background: 'var(--error-bg)',
                border: '1px solid var(--error-border)',
              }}
            >
              {error}
            </div>
          )}

          {!data ? (
            <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Loading columns…
            </div>
          ) : columns.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', margin: 0 }}>No custom columns yet. Add one below.</p>
          ) : (
            <ul aria-label="Custom columns" style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {columns.map((c, i) => (
                <ColumnRow
                  key={c.id}
                  column={c}
                  index={i}
                  total={columns.length}
                  all={columns}
                  busy={busy}
                  onPatch={onPatch}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}

          <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: 0 }}>
            Renaming keeps every value. Changing the type keeps existing values; ones that don&apos;t fit the new type are shown as plain text.
          </p>

          <form
            onSubmit={onAdd}
            aria-labelledby="column-add-title"
            style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <h3 id="column-add-title" style={{ fontSize: 12.5, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
              Add a column
            </h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <label htmlFor="column-add-name" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                New column name
              </label>
              <input
                id="column-add-name"
                ref={nameInputRef}
                value={newName}
                maxLength={MAX_COLUMN_NAME_LENGTH}
                placeholder="Column name"
                disabled={busy || columns.length >= MAX_COLUMNS}
                onChange={(e) => setNewName(e.target.value)}
                style={{ ...field, flex: 1, minWidth: 140 }}
              />
              <select
                aria-label="New column type"
                value={newType}
                disabled={busy}
                onChange={(e) => setNewType(e.target.value as ColumnType)}
                style={{ ...field, width: 110, cursor: 'pointer' }}
              >
                {COLUMN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {COLUMN_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={busy || !newName.trim() || columns.length >= MAX_COLUMNS} style={{ ...primaryBtn, opacity: busy || !newName.trim() ? 0.6 : 1 }}>
                {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}
                Add
              </button>
            </div>
            {newType === 'select' && (
              <>
                <label htmlFor="column-add-options" style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
                  Options (comma separated)
                </label>
                <input
                  id="column-add-options"
                  value={newOptions}
                  disabled={busy}
                  placeholder="e.g. Todo, Revisit, Done"
                  onChange={(e) => setNewOptions(e.target.value)}
                  style={{ ...field, width: '100%' }}
                />
              </>
            )}
            {columns.length >= MAX_COLUMNS && (
              <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: 0 }}>You can have at most {MAX_COLUMNS} custom columns.</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
