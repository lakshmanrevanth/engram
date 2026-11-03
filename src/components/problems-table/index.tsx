'use client';

import { siteConfig } from '@/config/site';
import useSWR, { useSWRConfig } from 'swr';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TabBar } from './tab-bar';
import { Toolbar } from './toolbar';
import { ProblemRow } from './row';
import { NewRow } from './new-row';
import { MobileRow } from './mobile-row';
import { ConfirmDialog } from './confirm-dialog';
import { ColumnSettings } from './column-settings';
import { AddToListMenu, ListsMenu, type ProblemListSummary } from './lists-menu';
import { AllCaughtUp, EmptyView, FirstRunPanel, NoMatches } from './empty-states';
import { useTableUrlState } from './use-table-url-state';
import {
  clearFilters,
  filterProblems,
  formatNextReview,
  hasActiveFilters,
  isDueToday,
  nextReviewAfterToday,
  sortProblems,
  topicOptions as buildTopicOptions,
  visibleLimitFor,
} from './filters';
import { CustomCheckbox } from '@/components/ui/custom-checkbox';
import { MoreVertical, Trash2, Download, Bookmark, Upload, ListMinus, Columns3 } from 'lucide-react';
import { ImportModal } from '@/components/import-modal';
import { getTopicColor, type TopicColor } from '@/lib/topic-colors';
import { Pill } from '@/components/ui/pill';
import { useMediaQuery } from '@/hooks/use-media-query';
import { fetcher } from '@/lib/fetcher';

// Rows rendered at a time; "Show more" adds another page. See report: chosen over
// virtualization because grouped rows, inline popovers and variable-height cells.
const PAGE_SIZE = 100;
const UNDO_MS = 6000;

function ColumnHeaderMenu({ col, onDelete }: { col: any; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {col.name}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-label={`Column settings for ${col.name}`}
        aria-haspopup="true"
        aria-expanded={open}
        style={{
          background: open ? 'var(--accent)' : 'none',
          border: 'none',
          color: open ? 'var(--foreground)' : hovered ? 'var(--muted-foreground)' : 'transparent',
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: 4,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s ease, background 0.15s ease',
        }}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        title="Column settings"
      >
        <MoreVertical size={13} aria-hidden />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--popover)', border: '1px solid var(--border)',
            borderRadius: 6, padding: 4, zIndex: 100, width: 140, boxShadow: 'var(--shadow-popover)',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(col.id); }}
            style={{
              background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 12, padding: '6px 10px', width: '100%',
              textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 4, transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--error-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <Trash2 size={13} aria-hidden />
            Delete column
          </button>
        </div>
      )}
    </div>
  );
}

function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)', height: 44 }}>
      <td style={{ width: 36, padding: '0 4px', textAlign: 'center' }}><Skeleton className="h-4 w-4 mx-auto rounded" /></td>
      <td style={{ width: 40, padding: '0 4px', textAlign: 'center' }}><Skeleton className="h-6 w-6 mx-auto rounded" /></td>
      <td style={{ width: 320, padding: '0 12px' }}><Skeleton className="h-4 w-48 rounded" /></td>
      <td style={{ width: 100, padding: '0 8px' }}><Skeleton className="h-5 w-16 rounded" /></td>
      <td style={{ width: 130, padding: '0 8px' }}><Skeleton className="h-5 w-20 rounded" /></td>
      <td style={{ width: 120, padding: '0 8px' }}><Skeleton className="h-4 w-20 rounded" /></td>
      <td style={{ width: 44, textAlign: 'center' }}><Skeleton className="h-4 w-4 mx-auto rounded" /></td>
      <td style={{ width: 130, padding: '0 8px' }}><Skeleton className="h-4 w-16 rounded" /></td>
      <td style={{ width: 180, padding: '0 12px' }}><Skeleton className="h-4 w-24 rounded" /></td>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} style={{ width: 140, padding: '0 8px' }}><Skeleton className="h-4 w-20 rounded" /></td>
      ))}
      <td style={{ width: 100 }} />
    </tr>
  );
}

function GroupHeader({ title, count, topicColor, open, onToggle, asRow = true }: {
  title: string;
  count: number;
  topicColor?: TopicColor;
  open: boolean;
  onToggle: () => void;
  asRow?: boolean;
}) {
  const button = (
    <button
      onClick={onToggle}
      aria-expanded={open}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 36, padding: '0 12px', background: 'none', border: 'none',
        cursor: 'pointer', textAlign: 'left', color: 'inherit',
      }}
    >
      <span aria-hidden style={{
        color: 'var(--text-subtle)', fontSize: 11, transition: 'transform 0.15s', display: 'inline-block',
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
      }}>▶</span>
      {topicColor ? (
        <Pill bg={topicColor.bg} text={topicColor.text} border={topicColor.border}>{title}</Pill>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500, textTransform: 'uppercase', fontFamily: 'var(--font-geist-mono), monospace', letterSpacing: '0.06em' }}>{title}</span>
      )}
      <span style={{ fontSize: 12, color: 'var(--text-subtle)', fontFamily: 'var(--font-geist-mono), monospace' }}>{count}</span>
    </button>
  );
  if (!asRow) return <div style={{ borderBottom: '1px solid var(--table-border)', background: 'var(--table-group-bg)' }}>{button}</div>;
  return (
    <tr style={{ borderBottom: '1px solid var(--table-border)', background: 'var(--table-group-bg)' }}>
      <td colSpan={100} style={{ padding: 0 }}>
        <div style={{ position: 'sticky', left: 0, width: 'max-content', minWidth: 240 }}>{button}</div>
      </td>
    </tr>
  );
}

function AddColumnPopover({ onSave }: { onSave: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    setName('');
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 11, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-geist-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}
      >
        + Add column
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, background: 'var(--popover)', border: '1px solid var(--input-border)', borderRadius: 8, padding: 12, zIndex: 50, width: 200, boxShadow: 'var(--shadow-popover)' }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>
            Column name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }}
              autoFocus
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--foreground)', fontSize: 13, padding: '5px 8px', width: '100%', outline: 'none', marginTop: 8 }}
              placeholder="e.g. Company"
            />
          </label>
          <button
            onClick={submit}
            style={{ background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--foreground)', cursor: 'pointer', fontSize: 12, padding: '4px 12px', width: '100%' }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

function HeaderIconButton({ label, onClick, children, ...rest }: { label: string; onClick: () => void; children: React.ReactNode } & Record<`data-${string}`, boolean>) {
  return (
    <button
      {...rest}
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        background: 'var(--icon-btn-bg)', border: '1px solid var(--icon-btn-border)', borderRadius: 6, color: 'var(--icon-btn-color)',
        cursor: 'pointer', fontSize: 13, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'color 0.15s, border-color 0.15s', padding: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--icon-btn-hover-border)'; e.currentTarget.style.color = 'var(--icon-btn-hover-color)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--icon-btn-border)'; e.currentTarget.style.color = 'var(--icon-btn-color)'; }}
    >
      {children}
    </button>
  );
}

type Toast = { id: number; msg: string; action?: { label: string; run: () => void } };

async function postJson(url: string, body: unknown, init?: RequestInit) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json;
}

const STATUS_GROUPS = [
  { key: 'ACTIVE', title: 'Active' },
  { key: 'MASTERED', title: 'Mastered' },
  { key: 'RETIRED', title: 'Retired' },
];

export function ProblemsTable() {
  const { data: allProblems, isLoading, mutate } = useSWR<any[]>('/api/problems', fetcher);
  const { data: rawLists, mutate: mutateLists } = useSWR<ProblemListSummary[]>('/api/lists', fetcher);
  const { mutate: globalMutate } = useSWRConfig();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [pendingColumnDelete, setPendingColumnDelete] = useState<{ id: string; name: string } | null>(null);
  const { data: rawColumns, mutate: mutateColumns } = useSWR('/api/columns', fetcher);
  const rawColumnsList: any[] = useMemo(() => (Array.isArray(rawColumns) ? rawColumns : []), [rawColumns]);
  const lists: ProblemListSummary[] = useMemo(() => (Array.isArray(rawLists) ? rawLists : []), [rawLists]);

  const [mounted, setMounted] = useState(false);
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isNarrow = useMediaQuery('(max-width: 768px)');
  const columns: any[] = mounted ? rawColumnsList : [];
  const [state, update] = useTableUrlState();
  const [showNewRow, setShowNewRow] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const pendingDelete = useRef<{ ids: string[]; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const tableRef = useRef<HTMLDivElement>(null);

  // Clear selection and paging when the visible rows change, so bulk actions never hit hidden rows.
  const viewKey = JSON.stringify([state.view, state.q, state.platforms, state.difficulties, state.statuses, state.topics, state.lists, state.due, state.group]);
  const [prevViewKey, setPrevViewKey] = useState(viewKey);
  if (prevViewKey !== viewKey) {
    setPrevViewKey(viewKey);
    setSelectedIds([]);
    setPageCount(1);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- avoids SWR cache hydration mismatch
  useEffect(() => { setMounted(true); }, []);

  const showSkeleton = !mounted || (isLoading && !allProblems);

  const showToast = useCallback((msg: string, action?: Toast['action'], ms = 3000) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), msg, action });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  // ---- Derived rows ----
  const now = new Date();
  const listMembers = useMemo(() => new Map(lists.map((l) => [l.id, new Set(l.problemIds)])), [lists]);
  const base = useMemo(() => {
    const arr = Array.isArray(allProblems) ? allProblems : [];
    if (pendingDeleteIds.length === 0) return arr;
    const hidden = new Set(pendingDeleteIds);
    return arr.filter((p) => !hidden.has(p.id));
  }, [allProblems, pendingDeleteIds]);
  const topicOpts = useMemo(() => buildTopicOptions(base), [base]);
  const activeListId = state.view.startsWith('list:') ? state.view.slice(5) : null;
  const activeList = activeListId ? lists.find((l) => l.id === activeListId) : undefined;
  // A list tab whose list no longer exists shows All.
  const view = activeListId && Array.isArray(rawLists) && !activeList ? 'all' : state.view;
  const viewState = view === state.view ? state : { ...state, view };
  const filtered = filterProblems(base, viewState, { now, listMembers });
  const sorted = sortProblems(filtered, state.sort, state.order);
  const limit = visibleLimitFor(sorted.map((p) => p.id), pageCount * PAGE_SIZE, highlightId);
  const shown = sorted.length > limit ? sorted.slice(0, limit) : sorted;
  const dueCount = base.filter((p) => isDueToday(p, now)).length;

  const isAllSelected = shown.length > 0 && shown.every((p) => selectedIds.includes(p.id));

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  const handleToggleSelectAll = () => {
    setSelectedIds(isAllSelected ? [] : shown.map((p) => p.id));
  };

  // ---- Highlight + scroll to a row ----
  useEffect(() => {
    if (!highlightId) return;
    const t1 = setTimeout(() => {
      document.getElementById(`problem-row-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    const t2 = setTimeout(() => setHighlightId(null), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [highlightId]);

  const jumpToProblem = useCallback((id: string) => {
    const p = base.find((x) => x.id === id);
    if (!p) return;
    if (filterProblems([p], state, { now: new Date(), listMembers }).length === 0) {
      update((s) => ({ ...clearFilters(s), view: 'all' }));
    }
    setShowNewRow(false);
    setHighlightId(id);
  }, [base, state, listMembers, update]);

  // ---- Delete with soft undo: the DELETE is sent only after the toast expires ----
  const commitDelete = useCallback(async (ids: string[], keepalive = false) => {
    try {
      await postJson('/api/problems/bulk', { ids, action: 'delete' }, keepalive ? { keepalive: true } : undefined);
      const gone = new Set(ids);
      mutate((prev: any[] | undefined) => prev?.filter((p) => !gone.has(p.id)) ?? [], { revalidate: false });
      mutateLists();
    } catch (e: any) {
      mutate();
      showToast(e?.message ?? 'Failed to delete problems');
    } finally {
      const gone = new Set(ids);
      setPendingDeleteIds((prev) => prev.filter((id) => !gone.has(id)));
    }
  }, [mutate, mutateLists, showToast]);

  const flushPendingDelete = useCallback((keepalive = false) => {
    const pending = pendingDelete.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingDelete.current = null;
    commitDelete(pending.ids, keepalive);
  }, [commitDelete]);

  const startDelete = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    flushPendingDelete();
    setShowDeleteModal(false);
    setSelectedIds([]);
    setPendingDeleteIds((prev) => [...prev, ...ids]);
    const timer = setTimeout(() => {
      pendingDelete.current = null;
      commitDelete(ids);
    }, UNDO_MS);
    pendingDelete.current = { ids, timer };
    const n = ids.length;
    showToast(`Deleted ${n} ${n === 1 ? 'problem' : 'problems'}`, {
      label: 'Undo',
      run: () => {
        if (pendingDelete.current?.ids !== ids) return;
        clearTimeout(pendingDelete.current.timer);
        pendingDelete.current = null;
        const restore = new Set(ids);
        setPendingDeleteIds((prev) => prev.filter((id) => !restore.has(id)));
        showToast(`Restored ${n} ${n === 1 ? 'problem' : 'problems'}`);
      },
    }, UNDO_MS);
  }, [commitDelete, flushPendingDelete, showToast]);

  // Leaving the page commits a pending delete.
  const flushRef = useRef(flushPendingDelete);
  useEffect(() => { flushRef.current = flushPendingDelete; }, [flushPendingDelete]);
  useEffect(() => {
    const onUnload = () => flushRef.current(true);
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.removeEventListener('pagehide', onUnload);
      flushRef.current(true);
    };
  }, []);

  // One row: undo is enough. Several: confirm first.
  const handleDeleteClick = useCallback(() => {
    if (selectedIds.length === 0) return;
    if (selectedIds.length === 1) startDelete([...selectedIds]);
    else setShowDeleteModal(true);
  }, [selectedIds, startDelete]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
      if (isEditable || showDeleteModal) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        handleDeleteClick();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedIds.length, showDeleteModal, handleDeleteClick]);

  // ---- Single-row edits (optimistic) ----
  const patchProblem = useCallback(async (id: string, patch: Record<string, unknown>, errorMsg: string, rethrow = true) => {
    mutate((prev: any[] | undefined) => prev?.map((p) => (p.id === id ? { ...p, ...patch } : p)) ?? [], { revalidate: false });
    try {
      const res = await fetch(`/api/problems/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(errorMsg);
    } catch (e: any) {
      mutate();
      showToast(e.message ?? errorMsg);
      if (rethrow) throw e;
    }
  }, [mutate, showToast]);

  const handleStarToggle = useCallback(
    (id: string, current: boolean) => { patchProblem(id, { isFavorite: !current }, 'Failed to update favorite', false); },
    [patchProblem]
  );
  const handleNotesSave = useCallback((id: string, notes: string) => patchProblem(id, { notes }, 'Failed to save notes'), [patchProblem]);
  const handleDifficultySave = useCallback((id: string, difficulty: string) => patchProblem(id, { difficulty }, 'Failed to update difficulty'), [patchProblem]);
  const handleTopicSave = useCallback((id: string, topic: string) => patchProblem(id, { topic }, 'Failed to update topic', false), [patchProblem]);

  const handleCustomFieldSave = useCallback(async (id: string, columnName: string, value: string) => {
    mutate(
      (prev: any[] | undefined) => prev?.map((p) => {
        if (p.id !== id) return p;
        const fields = (p.customFields as Record<string, string>) ?? {};
        return { ...p, customFields: { ...fields, [columnName]: value } };
      }) ?? [],
      { revalidate: false }
    );
    try {
      const res = await fetch(`/api/problems/${id}/custom-fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: columnName, value }),
      });
      if (!res.ok) throw new Error('Failed to save field');
    } catch (e: any) {
      mutate();
      showToast(e.message ?? 'Failed to save field');
      throw e;
    }
  }, [mutate, showToast]);

  const handleNewProblemSave = useCallback(async (data: any) => {
    const payload = { ...data, dateSolved: data.dateSolved ?? new Date().toISOString() };
    const res = await fetch('/api/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      // NewRow reads status/existingId to offer "Already tracked — jump to row".
      const err = new Error(json.error ?? 'Failed to create problem') as Error & { status?: number; existingId?: string };
      err.status = res.status;
      err.existingId = json.existingId;
      throw err;
    }

    mutate((prev: any[] | undefined) => [json, ...(prev?.filter((p) => p.id !== json.id) ?? [])], { revalidate: false });
    setShowNewRow(false);
    if (!json?.id) return;

    const visible = filterProblems([json], state, { now: new Date(), listMembers }).length > 0;
    if (visible) {
      setHighlightId(json.id);
    } else {
      showToast(`Added “${json.title}”. It's hidden by the current view.`, {
        label: 'Show',
        run: () => {
          update((s) => ({ ...clearFilters(s), view: 'all' }));
          setHighlightId(json.id);
          setToast(null);
        },
      }, UNDO_MS);
    }
  }, [mutate, state, listMembers, showToast, update]);

  const openNewRow = () => {
    setShowNewRow(true);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // ---- Custom columns ----
  const handleAddColumn = useCallback(async (name: string) => {
    const order = rawColumnsList.length;
    const tempId = `temp-${Date.now()}`;
    mutateColumns((prev: any[] | undefined) => [...(prev ?? []), { id: tempId, name, order }], { revalidate: false });
    try {
      const res = await fetch('/api/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, order }),
      });
      if (!res.ok) throw new Error('Failed to create column');
      const savedCol = await res.json();
      mutateColumns((prev: any[] | undefined) => prev?.map((c) => (c.id === tempId ? savedCol : c)) ?? [], { revalidate: false });
    } catch {
      mutateColumns();
      showToast('Failed to create column');
    }
  }, [rawColumnsList.length, mutateColumns, showToast]);

  // Deleting a column also deletes its values in every problem, so confirm first.
  const handleDeleteColumn = useCallback((id: string) => {
    const col = rawColumnsList.find((c: any) => c.id === id);
    setPendingColumnDelete({ id, name: col?.name ?? 'this column' });
  }, [rawColumnsList]);

  const confirmDeleteColumn = useCallback(async (id: string) => {
    setPendingColumnDelete(null);
    mutateColumns((prev: any[] | undefined) => prev?.filter((c) => c.id !== id) ?? [], { revalidate: false });
    try {
      const res = await fetch(`/api/columns/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete column');
      mutate();
    } catch {
      mutateColumns();
      showToast('Failed to delete column');
    }
  }, [mutateColumns, mutate, showToast]);

  // ---- Bulk actions (one request) ----
  const handleBulkStatusChange = useCallback(async (newStatus: string) => {
    const ids = [...selectedIds];
    const set = new Set(ids);
    mutate((prev: any[] | undefined) => prev?.map((p) => (set.has(p.id) ? { ...p, status: newStatus } : p)) ?? [], { revalidate: false });
    setSelectedIds([]);
    try {
      const { count } = await postJson('/api/problems/bulk', { ids, action: 'status', value: newStatus });
      showToast(`Marked ${count} ${count === 1 ? 'problem' : 'problems'} ${newStatus.toLowerCase()}`);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to update status');
    }
    mutate(); // pick up the review dates the server set for the new status
  }, [selectedIds, mutate, showToast]);

  const selectedAllFavorite = selectedIds.length > 0 && selectedIds.every((id) => base.find((p) => p.id === id)?.isFavorite);
  const handleBulkFavorite = useCallback(async () => {
    const ids = [...selectedIds];
    const value = !selectedAllFavorite;
    const set = new Set(ids);
    mutate((prev: any[] | undefined) => prev?.map((p) => (set.has(p.id) ? { ...p, isFavorite: value } : p)) ?? [], { revalidate: false });
    try {
      await postJson('/api/problems/bulk', { ids, action: 'favorite', value });
      showToast(`${value ? 'Bookmarked' : 'Removed bookmark from'} ${ids.length} ${ids.length === 1 ? 'problem' : 'problems'}`);
    } catch (e: any) {
      mutate();
      showToast(e?.message ?? 'Failed to update bookmarks');
    }
  }, [selectedIds, selectedAllFavorite, mutate, showToast]);

  // ---- Lists ----
  const createList = useCallback(async (name: string) => {
    const list = await postJson('/api/lists', { name });
    mutateLists((prev) => [...(prev ?? []), list], { revalidate: false });
    return list as ProblemListSummary;
  }, [mutateLists]);

  const renameList = useCallback(async (id: string, name: string) => {
    const res = await fetch(`/api/lists/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? 'Rename failed');
    mutateLists((prev) => prev?.map((l) => (l.id === id ? { ...l, name } : l)), { revalidate: false });
  }, [mutateLists]);

  const deleteList = useCallback(async (id: string) => {
    const name = lists.find((l) => l.id === id)?.name ?? 'list';
    mutateLists((prev) => prev?.filter((l) => l.id !== id), { revalidate: false });
    update((s) => ({ ...s, view: s.view === `list:${id}` ? 'all' : s.view, lists: s.lists.filter((x) => x !== id) }));
    try {
      const res = await fetch(`/api/lists/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete list');
      showToast(`Deleted list “${name}”`);
    } catch (e: any) {
      mutateLists();
      showToast(e?.message ?? 'Failed to delete list');
    }
  }, [lists, mutateLists, update, showToast]);

  const changeListMembers = useCallback(async (listId: string, ids: string[], action: 'add' | 'remove', listName?: string) => {
    try {
      const res = await postJson(`/api/lists/${listId}/problems`, { problemIds: ids, action });
      mutateLists((prev) => prev?.map((l) => (l.id === listId ? { ...l, count: res.count, problemIds: res.problemIds } : l)), { revalidate: false });
      const name = listName ?? lists.find((l) => l.id === listId)?.name ?? 'list';
      showToast(`${action === 'add' ? 'Added' : 'Removed'} ${res.changed} ${res.changed === 1 ? 'problem' : 'problems'} ${action === 'add' ? 'to' : 'from'} “${name}”`);
      if (action === 'remove') setSelectedIds([]);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to update list');
    }
  }, [lists, mutateLists, showToast]);

  const createAndAdd = useCallback(async (name: string) => {
    const list = await createList(name);
    await changeListMembers(list.id, [...selectedIds], 'add', list.name);
  }, [createList, changeListMembers, selectedIds]);

  const handleImportComplete = useCallback(
    (result: { imported: number; skipped: number; total: number; customColumnsCreated?: string[] }) => {
      mutate();
      mutateColumns();
      mutateLists();
      globalMutate('/api/columns');
      globalMutate((key: any) => typeof key === 'string' && key.startsWith('/api/problems'));
      const colMsg = result.customColumnsCreated && result.customColumnsCreated.length > 0 ? ` (+${result.customColumnsCreated.length} custom columns)` : '';
      showToast(`Imported ${result.imported} problems${colMsg}${result.skipped > 0 ? ` (${result.skipped} skipped)` : ''}`);
    },
    [mutate, mutateColumns, mutateLists, globalMutate, showToast]
  );

  // Plain function: `sorted` is rebuilt every render, so memoizing wouldn't help.
  const handleExportCSV = async () => {
    const ids = selectedIds.length > 0 ? [...selectedIds] : sorted.map((p: any) => p.id);
    if (ids.length === 0) {
      showToast('No problems to export');
      return;
    }
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'csv', ids }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${siteConfig.logoWord}-problems-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast(`Exported ${ids.length} ${ids.length === 1 ? 'problem' : 'problems'}`);
    } catch {
      showToast('Export failed');
    }
  };

  // First-run panel needs the user's ladder.
  const isFirstRun = !showSkeleton && Array.isArray(allProblems) && allProblems.length === 0;
  const { data: settings } = useSWR<any>(isFirstRun ? '/api/settings' : null, fetcher);
  const ladder: number[] | undefined = settings?.preferences?.ladderDays;

  const COLUMN_COUNT = columns.length;
  const viewLabel =
    view === 'due' ? 'Due Today' : view === 'bookmarked' ? 'Bookmarked' : activeList ? activeList.name : 'All Problems';

  // ---- Rendering ----
  const renderEmpty = () => {
    if (isFirstRun) return showNewRow ? null : <FirstRunPanel onAdd={openNewRow} onImport={() => setShowImportModal(true)} ladder={ladder} />;
    if (hasActiveFilters(state)) {
      return <NoMatches onClear={() => update(clearFilters)} />;
    }
    if (view === 'due') {
      const next = nextReviewAfterToday(base, now);
      return <AllCaughtUp nextReview={next ? formatNextReview(next, now) : null} />;
    }
    if (view === 'bookmarked') return <EmptyView heading="No bookmarks yet" text="Star a problem to keep it here." />;
    if (activeList) return <EmptyView heading="This list is empty" text="Select problems in All Problems, then choose “Add to list…”." />;
    return <NoMatches onClear={() => update((s) => ({ ...clearFilters(s), view: 'all' }))} message="Nothing to show in this view." />;
  };

  const renderRow = (p: any) =>
    isMobile ? (
      <MobileRow
        key={p.id}
        problem={p}
        isSelected={selectedIds.includes(p.id)}
        selectionMode={selectedIds.length > 0}
        isHighlighted={highlightId === p.id}
        onToggleSelect={handleToggleSelect}
        onStarToggle={handleStarToggle}
      />
    ) : (
      <ProblemRow
        key={p.id}
        problem={p}
        columns={columns}
        isSelected={selectedIds.includes(p.id)}
        isHighlighted={highlightId === p.id}
        onToggleSelect={handleToggleSelect}
        onStarToggle={handleStarToggle}
        onDifficultySave={handleDifficultySave}
        onTopicSave={handleTopicSave}
        onNotesSave={handleNotesSave}
        onCustomFieldSave={handleCustomFieldSave}
        onJumpToProblem={jumpToProblem}
        onDelete={(id: string) => startDelete([id])}
      />
    );

  const renderGroups = () => {
    if (state.group === 'none') return shown.map(renderRow);
    const groups: { key: string; title: string; color?: TopicColor; total: number; rows: any[] }[] = [];
    if (state.group === 'status') {
      for (const g of STATUS_GROUPS) {
        const total = sorted.filter((p) => p.status === g.key).length;
        if (total) groups.push({ key: g.key, title: g.title, total, rows: shown.filter((p) => p.status === g.key) });
      }
    } else {
      const totals = new Map<string, number>();
      for (const p of sorted) totals.set(p.topic || 'General', (totals.get(p.topic || 'General') ?? 0) + 1);
      for (const [topic, total] of totals) {
        groups.push({ key: `t:${topic}`, title: topic, color: getTopicColor(topic), total, rows: shown.filter((p) => (p.topic || 'General') === topic) });
      }
    }
    return groups.map((g) => {
      const open = !collapsed[g.key];
      const toggle = () => setCollapsed((c) => ({ ...c, [g.key]: open }));
      const header = <GroupHeader key={`h-${g.key}`} title={g.title} count={g.total} topicColor={g.color} open={open} onToggle={toggle} asRow={!isMobile} />;
      return [header, ...(open ? g.rows.map(renderRow) : [])];
    });
  };

  const remaining = sorted.length - shown.length;
  const showMoreButton = remaining > 0 && (
    <button
      onClick={() => setPageCount((c) => c + 1)}
      style={{
        background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--foreground)',
        fontSize: 12.5, padding: '6px 14px', cursor: 'pointer',
      }}
    >
      Show {Math.min(PAGE_SIZE, remaining)} more <span style={{ color: 'var(--text-subtle)' }}>({remaining} hidden)</span>
    </button>
  );

  const newRowBar = (
    <button
      onClick={openNewRow}
      style={{
        width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid var(--table-border)', cursor: 'pointer', display: 'flex',
        alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--bottom-bar-color)', transition: 'background 0.15s, color 0.15s',
        background: 'var(--bottom-bar-bg)', textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bottom-bar-hover-bg)'; e.currentTarget.style.color = 'var(--bottom-bar-hover-color)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bottom-bar-bg)'; e.currentTarget.style.color = 'var(--bottom-bar-color)'; }}
    >
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>+</span>
      <span>New row</span>
    </button>
  );

  const newRow = (
    <NewRow
      onSave={handleNewProblemSave}
      onCancel={() => setShowNewRow(false)}
      columns={columns}
      onJumpToProblem={jumpToProblem}
    />
  );

  const renderTableHead = () => (
    <thead>
      <tr style={{ borderBottom: '1px solid var(--border)', height: 36, background: 'var(--secondary)' }}>
        <th data-cell="checkbox" style={{ width: 36, padding: '0 4px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CustomCheckbox
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
              title={isAllSelected ? 'Deselect all' : 'Select all'}
              opacity={selectedIds.length > 0 ? 1 : 0.4}
            />
          </div>
        </th>
        <th data-cell="platform" style={{ width: 40, padding: '0 4px' }}><span className="sr-only">Platform</span></th>
        {[
          { label: 'PROBLEM', width: 340, padding: '0 16px', dataCol: 'problem' },
          { label: 'DIFFICULTY', width: 115, padding: '0 12px', dataCol: 'difficulty' },
          { label: 'TOPIC', width: 185, padding: '0 12px', dataCol: 'topic' },
          { label: 'STATUS', width: 140, padding: '0 12px', dataCol: 'status' },
          { label: 'STAR', icon: <Bookmark size={13} strokeWidth={2} aria-hidden style={{ color: 'var(--muted-foreground)' }} />, width: 44, center: true, padding: '0', dataCol: 'star' },
          { label: 'NEXT REVISION', width: 140, padding: '0 12px', dataCol: 'next-revision' },
          { label: 'NOTES', width: 190, padding: '0 12px', dataCol: 'notes' },
        ].map(({ label, icon, width, center, padding, dataCol }) => (
          <th key={label} data-col={dataCol} data-cell={dataCol} style={{
            width, padding: padding ?? (center ? '0' : '0 8px'), textAlign: center ? 'center' : 'left', fontSize: 11,
            fontFamily: 'var(--font-geist-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--muted-foreground)', fontWeight: 500, whiteSpace: 'nowrap',
          }}>
            {icon ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Bookmarked">
                {icon}<span className="sr-only">Bookmarked</span>
              </div>
            ) : label}
          </th>
        ))}
        {columns.map((col) => (
          <th key={col.id} data-col="custom" data-cell="custom" style={{ width: 140, padding: '0 8px', fontSize: 11, fontFamily: 'var(--font-geist-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            <ColumnHeaderMenu col={col} onDelete={handleDeleteColumn} />
          </th>
        ))}
        <th data-col="custom" data-cell="custom" style={{ width: 100, padding: '0 8px' }}>
          <AddColumnPopover onSave={handleAddColumn} />
        </th>
      </tr>
    </thead>
  );

  const empty = !showSkeleton && sorted.length === 0;
  const stickyBlock: React.CSSProperties = { position: 'sticky', left: 0 };

  const selBtn = (bg: string, border: string, color: string): React.CSSProperties => ({
    background: bg, border: `1px solid ${border}`, borderRadius: 4, color, cursor: 'pointer', fontSize: 12, padding: '4px 8px', fontWeight: 500, whiteSpace: 'nowrap',
  });

  return (
    <div data-dashboard-container style={{ padding: '24px 32px' }}>
      {/* Toasts (always mounted so screen readers pick up changes) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'fixed', bottom: isNarrow ? (selectedIds.length ? 112 : 84) : 24, right: isNarrow ? 12 : 24, left: isNarrow ? 12 : 'auto', zIndex: 1000, display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none' }}
      >
        {toast && (
          <div
            key={toast.id}
            style={{
              background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--foreground)', fontSize: 13,
              padding: '10px 16px', boxShadow: 'var(--shadow-popover)', display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'auto', maxWidth: 420,
            }}
          >
            <span>{toast.msg}</span>
            {toast.action && (
              <button
                onClick={toast.action.run}
                style={{ background: 'none', border: 'none', color: 'var(--foreground)', fontWeight: 600, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Floating action bar when rows selected */}
      {selectedIds.length > 0 && (
        <div
          data-selection-bar
          role="toolbar"
          aria-label={`${selectedIds.length} selected`}
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 900, background: 'var(--popover)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: 'var(--shadow-popover)',
          }}
        >
          <span data-selection-count style={{ fontSize: 13, color: 'var(--foreground)', fontFamily: 'var(--font-geist-mono), monospace', whiteSpace: 'nowrap' }}>
            <span className="hidden md:inline">{selectedIds.length} selected</span>
            <span className="inline md:hidden">{selectedIds.length} sel</span>
          </span>
          <div data-selection-divider style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />

          <div data-selection-actions style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button data-selection-btn="mastered" onClick={() => handleBulkStatusChange('MASTERED')} style={selBtn('var(--success-bg)', 'var(--success-border)', 'var(--success)')}>
              <span className="hidden md:inline">Mark Mastered</span>
              <span className="inline md:hidden">Mastered</span>
            </button>
            <button data-selection-btn="active" onClick={() => handleBulkStatusChange('ACTIVE')} style={selBtn('var(--secondary)', 'var(--border)', 'var(--foreground)')}>
              <span className="hidden md:inline">Mark Active</span>
              <span className="inline md:hidden">Active</span>
            </button>
            <button data-selection-btn="retired" onClick={() => handleBulkStatusChange('RETIRED')} style={selBtn('var(--medium-bg)', 'var(--medium-border)', 'var(--medium-text)')}>
              <span className="hidden md:inline">Mark Retired</span>
              <span className="inline md:hidden">Retired</span>
            </button>
            <button
              data-selection-btn="bookmark"
              onClick={handleBulkFavorite}
              aria-label={selectedAllFavorite ? 'Remove bookmarks from selected' : 'Bookmark selected'}
              title={selectedAllFavorite ? 'Remove bookmarks' : 'Bookmark'}
              style={{ ...selBtn('var(--secondary)', 'var(--border)', 'var(--foreground)'), display: 'flex', alignItems: 'center' }}
            >
              <Bookmark size={13} aria-hidden fill={selectedAllFavorite ? 'currentColor' : 'none'} />
            </button>
            <AddToListMenu
              lists={lists}
              compact={isNarrow}
              onAdd={(listId) => changeListMembers(listId, [...selectedIds], 'add')}
              onCreateAndAdd={createAndAdd}
            />
            {activeList && (
              <button
                data-selection-btn="remove-from-list"
                onClick={() => changeListMembers(activeList.id, [...selectedIds], 'remove')}
                aria-label={`Remove selected from ${activeList.name}`}
                title={`Remove from “${activeList.name}”`}
                style={{ ...selBtn('var(--secondary)', 'var(--border)', 'var(--foreground)'), display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <ListMinus size={13} aria-hidden />
                <span className="hidden md:inline">Remove</span>
              </button>
            )}
          </div>

          <div data-selection-divider style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />

          <button
            data-selection-delete
            onClick={handleDeleteClick}
            aria-label={`Delete ${selectedIds.length} selected`}
            style={{
              background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 4, color: 'var(--error)', cursor: 'pointer',
              fontSize: 13, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s', flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--error-border)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--error-bg)')}
          >
            <Trash2 size={13} aria-hidden />
            <span className="hidden md:inline">Delete</span>
          </button>
          <button
            data-selection-close
            onClick={() => setSelectedIds([])}
            aria-label="Clear selection"
            title="Clear selection"
            style={{
              background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', fontSize: 13, padding: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Page header */}
      <div data-page-header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div data-breadcrumb style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--text-subtle)' }}>{siteConfig.logoWord}</span>
          <span style={{ color: 'var(--text-faint)', margin: '0 8px' }}>/</span>
          <h1 style={{ display: 'inline', fontSize: 'inherit', color: 'var(--foreground)', fontWeight: 500 }}>{viewLabel}</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HeaderIconButton data-import-button label="Import problems from CSV / Excel" onClick={() => setShowImportModal(true)}>
            <Upload size={14} aria-hidden />
          </HeaderIconButton>
          <HeaderIconButton data-download-button label="Export problems to CSV" onClick={handleExportCSV}>
            <Download size={14} aria-hidden />
          </HeaderIconButton>
          <HeaderIconButton label="Manage custom columns" onClick={() => setShowColumnSettings(true)}>
            <Columns3 size={14} aria-hidden />
          </HeaderIconButton>

          <button
            data-new-problem-button
            id="new-problem-btn"
            onClick={openNewRow}
            style={{
              background: 'var(--new-problem-btn-bg)', border: '1px solid var(--new-problem-btn-border)', borderRadius: 6,
              color: 'var(--new-problem-btn-color)', cursor: 'pointer', fontSize: 13, padding: '6px 14px', display: 'flex',
              alignItems: 'center', gap: 6, fontWeight: 500,
            }}
          >
            <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Problem
          </button>
        </div>
      </div>

      <TabBar
        activeTab={view}
        onChange={(view) => update({ view })}
        lists={lists}
        dueCount={mounted ? dueCount : undefined}
        trailing={
          <ListsMenu
            lists={lists}
            onOpen={(id) => update({ view: `list:${id}` })}
            onCreate={async (name) => { const l = await createList(name); update({ view: `list:${l.id}` }); }}
            onRename={renameList}
            onDelete={deleteList}
          />
        }
      />

      <div style={{ margin: '16px 0' }}>
        <Toolbar state={state} onChange={update} topicOptions={topicOpts} lists={lists} />
      </div>

      {isMobile ? (
        <div
          ref={tableRef}
          data-mobile-list
          style={{ borderRadius: 8, border: '1px solid var(--table-border)', background: 'var(--card)', overflow: 'hidden' }}
        >
          {showNewRow ? (
            // NewRow renders a <tr>, so it needs a (scrollable) table on phones.
            <div style={{ overflowX: 'auto', borderBottom: '1px solid var(--table-border)' }}>
              <table style={{ minWidth: 1230, borderCollapse: 'collapse', tableLayout: 'fixed' }}><tbody>{newRow}</tbody></table>
            </div>
          ) : newRowBar}
          {!showSkeleton && shown.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: '1px solid var(--table-border)', background: 'var(--secondary)' }}>
              <div style={{ minWidth: 32, display: 'flex', justifyContent: 'center' }}>
                <CustomCheckbox checked={isAllSelected} onChange={handleToggleSelectAll} title={isAllSelected ? 'Deselect all' : 'Select all'} size={18} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-geist-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {sorted.length} {sorted.length === 1 ? 'problem' : 'problems'} · long-press to select
              </span>
            </div>
          )}
          {showSkeleton
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--table-border)' }}>
                  <Skeleton className="h-4 w-48 rounded" />
                </div>
              ))
            : empty ? renderEmpty() : renderGroups()}
          {showMoreButton && <div style={{ padding: 12, display: 'flex', justifyContent: 'center' }}>{showMoreButton}</div>}
        </div>
      ) : (
        <div
          ref={tableRef}
          data-table-container
          data-table-scroll-container
          style={{ overflowX: 'auto', maxWidth: '100%', borderRadius: 8, border: '1px solid var(--table-border)', background: 'var(--card)' }}
        >
          {!showNewRow && <div style={stickyBlock}>{newRowBar}</div>}
          <table data-problems-table style={{ width: '100%', minWidth: 1230 + COLUMN_COUNT * 140, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            {renderTableHead()}
            <tbody>
              {showNewRow && newRow}
              {showSkeleton
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} columns={COLUMN_COUNT} />)
                : empty ? null : renderGroups()}
            </tbody>
          </table>
          {empty && <div style={stickyBlock}>{renderEmpty()}</div>}
          {showMoreButton && (
            <div style={{ ...stickyBlock, padding: 12, display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--table-border)' }}>
              {showMoreButton}
            </div>
          )}
        </div>
      )}

      {showImportModal && (
        <ImportModal open={showImportModal} onClose={() => setShowImportModal(false)} onImportComplete={handleImportComplete} />
      )}

      <ColumnSettings open={showColumnSettings} onClose={() => setShowColumnSettings(false)} onChanged={() => { mutateColumns(); mutate(); }} />

      {pendingColumnDelete && (
        <ConfirmDialog
          title={`Delete column “${pendingColumnDelete.name}”?`}
          description="Its values are removed from every problem. This can't be undone."
          confirmLabel="Delete column"
          onConfirm={() => confirmDeleteColumn(pendingColumnDelete.id)}
          onCancel={() => setPendingColumnDelete(null)}
        />
      )}

      {showDeleteModal && (
        <ConfirmDialog
          title={`Delete ${selectedIds.length} ${selectedIds.length === 1 ? 'problem' : 'problems'}?`}
          description={`This also deletes their review history. You can undo for a few seconds after deleting.`}
          confirmLabel={`Delete ${selectedIds.length}`}
          onConfirm={() => startDelete([...selectedIds])}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
