'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ListPlus, ListChecks, Pencil, Trash2, X } from 'lucide-react';

export type ProblemListSummary = { id: string; name: string; count: number; problemIds: string[] };

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref, btnRef };
}

const panel = (placement: 'down' | 'up'): React.CSSProperties => ({
  position: 'absolute',
  ...(placement === 'down' ? { top: '100%', marginTop: 4 } : { bottom: '100%', marginBottom: 8 }),
  right: 0,
  background: 'var(--popover)',
  border: '1px solid var(--popover-border)',
  borderRadius: 8,
  padding: 6,
  zIndex: 950,
  width: 240,
  maxHeight: 340,
  overflowY: 'auto',
  boxShadow: 'var(--shadow-popover)',
});

const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--foreground)',
  fontSize: 12.5, padding: '5px 8px', width: '100%', outline: 'none', minWidth: 0,
};

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 4,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};

function NewListInput({ onCreate, placeholder = 'New list name…' }: { onCreate: (name: string) => Promise<unknown>; placeholder?: string }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await onCreate(name.trim());
      setName('');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create list');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ padding: 4 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder={placeholder}
          aria-label="New list name"
          maxLength={60}
          style={inputStyle}
        />
        <button onClick={submit} disabled={!name.trim() || busy} aria-label="Create list" style={{ ...iconBtn, border: '1px solid var(--border)', background: 'var(--secondary)' }}>
          <ListPlus size={14} />
        </button>
      </div>
      {error && <div role="alert" style={{ fontSize: 11.5, color: 'var(--error)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

function ListItem({ list, onOpen, onRename, onDelete }: {
  list: ProblemListSummary;
  onOpen: () => void;
  onRename: (name: string) => Promise<unknown>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(list.name);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim() || name.trim() === list.name) { setEditing(false); return; }
    try {
      await onRename(name.trim());
      setEditing(false);
      setError('');
    } catch (e: any) {
      setError(e?.message ?? 'Rename failed');
    }
  };

  if (editing) {
    return (
      <div style={{ padding: 4 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            value={name}
            autoFocus
            maxLength={60}
            aria-label={`Rename list ${list.name}`}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); save(); }
              if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); setEditing(false); setName(list.name); }
            }}
            style={inputStyle}
          />
          <button onClick={save} aria-label="Save name" style={iconBtn}><Check size={14} /></button>
          <button onClick={() => { setEditing(false); setName(list.name); }} aria-label="Cancel rename" style={iconBtn}><X size={14} /></button>
        </div>
        {error && <div role="alert" style={{ fontSize: 11.5, color: 'var(--error)', marginTop: 4 }}>{error}</div>}
      </div>
    );
  }

  if (confirming) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', fontSize: 12.5, color: 'var(--text-normal)' }}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Delete “{list.name}”?</span>
        <button onClick={onDelete} autoFocus style={{ ...iconBtn, color: 'var(--error)', fontSize: 12 }}>Delete</button>
        <button onClick={() => setConfirming(false)} style={{ ...iconBtn, fontSize: 12 }}>Keep</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderRadius: 5 }}>
      <button
        onClick={onOpen}
        style={{
          flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '6px 8px',
          fontSize: 13, color: 'var(--text-normal)', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 5,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--dropdown-item-hover-bg)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
      >
        <ListChecks size={13} aria-hidden />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.name}</span>
        <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-geist-mono), monospace' }}>{list.count}</span>
      </button>
      <button onClick={() => setEditing(true)} aria-label={`Rename list ${list.name}`} title="Rename" style={iconBtn}><Pencil size={13} /></button>
      <button onClick={() => setConfirming(true)} aria-label={`Delete list ${list.name}`} title="Delete" style={{ ...iconBtn, color: 'var(--error)' }}><Trash2 size={13} /></button>
    </div>
  );
}

/** Tab-bar menu: open, create, rename and delete lists. */
export function ListsMenu({ lists, onOpen, onCreate, onRename, onDelete }: {
  lists: ProblemListSummary[];
  onOpen: (id: string) => void;
  onCreate: (name: string) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<unknown>;
  onDelete: (id: string) => void;
}) {
  const { open, setOpen, ref, btnRef } = usePopover();
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'none', border: 'none', color: open ? 'var(--foreground)' : 'var(--text-subtle)', cursor: 'pointer',
          fontSize: 13, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        }}
      >
        <ListPlus size={14} aria-hidden />
        <span>Lists</span>
      </button>
      {open && (
        <div style={panel('down')}>
          <div style={{ padding: '2px 4px 6px', fontSize: 10, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Lists
          </div>
          {lists.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '4px 8px 8px', lineHeight: 1.5 }}>
              Group problems into lists like “Blind 75”. Each list gets its own tab.
            </div>
          )}
          {lists.map((l) => (
            <ListItem
              key={l.id}
              list={l}
              onOpen={() => { onOpen(l.id); setOpen(false); }}
              onRename={(name) => onRename(l.id, name)}
              onDelete={() => onDelete(l.id)}
            />
          ))}
          <div style={{ borderTop: '1px solid var(--input-border)', margin: '6px 0' }} />
          <NewListInput onCreate={onCreate} />
        </div>
      )}
    </div>
  );
}

/** Selection-bar menu: add the selected problems to a list (or a new one). */
export function AddToListMenu({ lists, onAdd, onCreateAndAdd, compact }: {
  lists: ProblemListSummary[];
  onAdd: (listId: string) => void;
  onCreateAndAdd: (name: string) => Promise<unknown>;
  compact?: boolean;
}) {
  const { open, setOpen, ref, btnRef } = usePopover();
  // Fixed position: the selection bar scrolls horizontally on mobile and would clip an absolute panel.
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);
  const toggle = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ bottom: window.innerHeight - r.top + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - 248)) });
    setOpen((o) => !o);
  };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        data-selection-btn="add-to-list"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Add selected to list"
        onClick={toggle}
        style={{
          background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--foreground)',
          cursor: 'pointer', fontSize: 12, padding: '4px 8px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
        }}
      >
        <ListPlus size={13} aria-hidden />
        {!compact && <span>Add to list…</span>}
      </button>
      {open && (
        <div style={{ ...panel('up'), position: 'fixed', bottom: pos?.bottom ?? 80, left: pos?.left ?? 8, right: 'auto', marginBottom: 0 }}>
          {lists.map((l) => (
            <button
              key={l.id}
              onClick={() => { onAdd(l.id); setOpen(false); }}
              style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '6px 8px',
                fontSize: 13, color: 'var(--text-normal)', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 5,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--dropdown-item-hover-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <ListChecks size={13} aria-hidden />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-geist-mono), monospace' }}>{l.count}</span>
            </button>
          ))}
          {lists.length > 0 && <div style={{ borderTop: '1px solid var(--input-border)', margin: '6px 0' }} />}
          <NewListInput
            placeholder="Create list and add…"
            onCreate={async (name) => { await onCreateAndAdd(name); setOpen(false); }}
          />
        </div>
      )}
    </div>
  );
}
