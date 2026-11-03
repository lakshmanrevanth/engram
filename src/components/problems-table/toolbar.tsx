'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { CustomCheckbox } from '@/components/ui/custom-checkbox';
import { PlatformLogo } from '@/lib/platforms/logos';
import {
  DIFFICULTY_KEYS,
  PLATFORM_KEYS,
  STATUS_KEYS,

  type DueFilter,
  type GroupBy,
  type TableState,
} from './filters';

export type { SortOrder } from './filters';

type ToolbarProps = {
  state: TableState;
  onChange: (patch: Partial<TableState>) => void;
  topicOptions: { value: string; count: number }[];
  lists: { id: string; name: string }[];
};

const PLATFORM_LABELS: Record<string, string> = {
  LEETCODE: 'LeetCode',
  CODEFORCES: 'Codeforces',
  CODECHEF: 'CodeChef',
  GFG: 'GeeksForGeeks',
  HACKERRANK: 'HackerRank',
  SYSTEM_DESIGN: 'System Design',
};
const SORT_OPTIONS = [
  { value: 'dateAdded', label: 'Date Added' },
  { value: 'nextRevision', label: 'Next Revision' },
  { value: 'problemNumber', label: 'Problem Number' },
  { value: 'difficulty', label: 'Difficulty' },
  { value: 'status', label: 'Status' },
  { value: 'topic', label: 'Topic' },
];
const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'No grouping' },
  { value: 'status', label: 'Status' },
  { value: 'topic', label: 'Topic' },
];

const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

const sectionLabel: React.CSSProperties = {
  padding: '2px 4px 6px', fontSize: 10, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em',
};
const controlStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  borderRadius: 6,
  color: 'var(--text-normal)',
  cursor: 'pointer',
  fontSize: 13,
  padding: '6px 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'border-color 0.15s, color 0.15s',
  whiteSpace: 'nowrap',
};

function DropdownMenu({ label, active, children, width = 180 }: { label: string; active?: boolean; children: React.ReactNode; width?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ ...controlStyle, borderColor: active ? 'var(--input-focus-border)' : 'var(--input-border)', color: active ? 'var(--text-strong)' : 'var(--text-normal)' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--input-focus-border)'; e.currentTarget.style.color = 'var(--text-strong)'; }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = active ? 'var(--input-focus-border)' : 'var(--input-border)';
          e.currentTarget.style.color = active ? 'var(--text-strong)' : 'var(--text-normal)';
        }}
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: 'var(--popover)', border: '1px solid var(--popover-border)', borderRadius: 8,
            padding: 6, zIndex: 50, minWidth: width, maxHeight: 360, overflowY: 'auto', boxShadow: 'var(--shadow-popover)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function CheckItem({ label, checked, onChange, icon, count }: { label: string; checked: boolean; onChange: () => void; icon?: React.ReactNode; count?: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onChange}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', cursor: 'pointer', borderRadius: 5, fontSize: 13,
        color: checked || hovered ? 'var(--text-strong)' : 'var(--text-normal)',
        background: hovered ? 'var(--dropdown-item-hover-bg)' : 'transparent',
        transition: 'background 0.15s, color 0.15s', userSelect: 'none',
      }}
    >
      <CustomCheckbox checked={checked} onChange={onChange} size={15} title={label} />
      {icon}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {typeof count === 'number' && <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-geist-mono), monospace' }}>{count}</span>}
    </div>
  );
}

function OptionButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      style={{
        display: 'block', width: '100%', background: selected ? 'var(--dropdown-item-hover-bg)' : 'none', border: 'none', borderRadius: 4,
        color: selected ? 'var(--text-strong)' : 'var(--text-normal)', cursor: 'pointer', fontSize: 13, padding: '5px 8px', textAlign: 'left',
      }}
    >
      {children}
    </button>
  );
}

function TopicPicker({ options, selected, onToggle }: { options: { value: string; count: number }[]; selected: string[]; onToggle: (v: string) => void }) {
  const [q, setQ] = useState('');
  const sel = new Set(selected.map((s) => s.toLowerCase()));
  const shown = options.filter((o) => o.value.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find topic or tag…"
        aria-label="Find topic or tag"
        autoFocus
        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--foreground)', fontSize: 12.5, padding: '5px 8px', width: '100%', outline: 'none', marginBottom: 4 }}
      />
      {shown.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '6px 10px' }}>No topics</div>}
      {shown.map((o) => (
        <CheckItem key={o.value} label={o.value} count={o.count} checked={sel.has(o.value.toLowerCase())} onChange={() => onToggle(o.value)} />
      ))}
    </>
  );
}

export function Toolbar({ state, onChange, topicOptions, lists }: ToolbarProps) {
  const { q: search, platforms, difficulties, statuses, topics, due, sort, order, group } = state;

  // Local search value, debounced up; external resets (e.g. "Clear filters") flow back down.
  const [searchVal, setSearchVal] = useState(search);
  const lastEmitted = useRef(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (search !== lastEmitted.current) {
      lastEmitted.current = search;
      setSearchVal(search);
    }
  }, [search]);
  const handleSearch = (v: string) => {
    setSearchVal(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastEmitted.current = v;
      onChange({ q: v });
    }, 150);
  };

  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const el = document.activeElement as HTMLElement | null;
      const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable;
      if (isCmdK || (e.key === '/' && !typing)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const listName = (id: string) => lists.find((l) => l.id === id)?.name ?? 'Unknown list';
  const activeFilters = [
    ...platforms.map((p) => ({ key: `p-${p}`, label: PLATFORM_LABELS[p] ?? p, remove: () => onChange({ platforms: toggle(platforms, p) }) })),
    ...topics.map((t) => ({ key: `t-${t}`, label: `#${t}`, remove: () => onChange({ topics: topics.filter((x) => x !== t) }) })),
    ...difficulties.map((d) => ({ key: `d-${d}`, label: cap(d), remove: () => onChange({ difficulties: toggle(difficulties, d) }) })),
    ...statuses.map((s) => ({ key: `s-${s}`, label: cap(s), remove: () => onChange({ statuses: toggle(statuses, s) }) })),
    ...state.lists.map((l) => ({ key: `l-${l}`, label: `List: ${listName(l)}`, remove: () => onChange({ lists: toggle(state.lists, l) }) })),
  ];
  const otherCount = difficulties.length + statuses.length + state.lists.length;

  const quick = (value: Exclude<DueFilter, ''>, label: string) => {
    const on = due === value;
    return (
      <button
        aria-pressed={on}
        onClick={() => onChange({ due: on ? '' : value })}
        style={{
          ...controlStyle,
          padding: '6px 10px',
          background: on ? 'var(--filter-chip-bg)' : 'var(--input-bg)',
          borderColor: on ? 'var(--input-focus-border)' : 'var(--input-border)',
          color: on ? 'var(--text-strong)' : 'var(--text-normal)',
        }}
      >
        {label}
      </button>
    );
  };

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort';

  return (
    <div data-toolbar>
      <div data-table-toolbar style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div data-search-container style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', pointerEvents: 'none' }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            data-search-input
            ref={searchInputRef}
            type="search"
            aria-label="Search problems by title, number, code, topic, tag or notes"
            value={searchVal}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape' && searchVal) { e.preventDefault(); handleSearch(''); } }}
            placeholder="Search problems..."
            style={{
              background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--foreground)',
              fontSize: 13, padding: '6px 28px 6px 32px', outline: 'none', width: 220, maxWidth: '100%',
            }}
          />
          {!searchVal && (
            <kbd data-search-shortcut-hint aria-hidden style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'var(--kbd-bg)',
              border: '1px solid var(--kbd-border)', borderRadius: 4, padding: '1px 5px', fontSize: 10, color: 'var(--kbd-color)',
              fontFamily: 'var(--font-geist-mono), monospace', pointerEvents: 'none', lineHeight: 1.2,
            }}>
              /
            </kbd>
          )}
        </div>

        <div data-filter-sort-row style={{ display: 'contents' }}>
          <DropdownMenu label={platforms.length ? `Platform (${platforms.length})` : 'Platform'} active={platforms.length > 0}>
            {PLATFORM_KEYS.map((p) => (
              <CheckItem
                key={p}
                label={PLATFORM_LABELS[p]}
                icon={<PlatformLogo platform={p} size={16} padding={0} />}
                checked={platforms.includes(p)}
                onChange={() => onChange({ platforms: toggle(platforms, p) })}
              />
            ))}
          </DropdownMenu>

          <DropdownMenu label={topics.length ? `Topic (${topics.length})` : 'Topic'} active={topics.length > 0} width={220}>
            <TopicPicker
              options={topicOptions}
              selected={topics}
              onToggle={(t) => {
                const lower = t.toLowerCase();
                const has = topics.some((x) => x.toLowerCase() === lower);
                onChange({ topics: has ? topics.filter((x) => x.toLowerCase() !== lower) : [...topics, t] });
              }}
            />
          </DropdownMenu>

          {quick('overdue', 'Overdue')}
          {quick('week', 'Due this week')}

          <DropdownMenu label={otherCount ? `Filters (${otherCount})` : 'Filter'} active={otherCount > 0}>
            <div style={sectionLabel}>Difficulty</div>
            {DIFFICULTY_KEYS.map((d) => (
              <CheckItem key={d} label={cap(d)} checked={difficulties.includes(d)} onChange={() => onChange({ difficulties: toggle(difficulties, d) })} />
            ))}
            <div style={{ borderTop: '1px solid var(--input-border)', margin: '6px 0' }} />
            <div style={sectionLabel}>Status</div>
            {STATUS_KEYS.map((s) => (
              <CheckItem key={s} label={cap(s)} checked={statuses.includes(s)} onChange={() => onChange({ statuses: toggle(statuses, s) })} />
            ))}
            {lists.length > 0 && (
              <>
                <div style={{ borderTop: '1px solid var(--input-border)', margin: '6px 0' }} />
                <div style={sectionLabel}>List</div>
                {lists.map((l) => (
                  <CheckItem key={l.id} label={l.name} checked={state.lists.includes(l.id)} onChange={() => onChange({ lists: toggle(state.lists, l.id) })} />
                ))}
              </>
            )}
          </DropdownMenu>

          <DropdownMenu label={group === 'none' ? 'Group' : `Group: ${GROUP_OPTIONS.find((g) => g.value === group)?.label}`} active={group !== 'none'} width={150}>
            {GROUP_OPTIONS.map((g) => (
              <OptionButton key={g.value} selected={group === g.value} onClick={() => onChange({ group: g.value })}>{g.label}</OptionButton>
            ))}
          </DropdownMenu>

          <DropdownMenu label={`Sort: ${currentSortLabel}`}>
            {SORT_OPTIONS.map((opt) => (
              <OptionButton key={opt.value} selected={sort === opt.value} onClick={() => onChange({ sort: opt.value })}>{opt.label}</OptionButton>
            ))}
          </DropdownMenu>
        </div>

        <button
          data-redundant-sort-icon-button
          onClick={() => onChange({ order: order === 'asc' ? 'desc' : 'asc' })}
          aria-label={order === 'asc' ? 'Sort ascending. Switch to descending' : 'Sort descending. Switch to ascending'}
          title={order === 'asc' ? 'Ascending Order (click for Descending)' : 'Descending Order (click for Ascending)'}
          style={{ ...controlStyle, width: 30, height: 30, padding: 0, justifyContent: 'center', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--input-focus-border)'; e.currentTarget.style.color = 'var(--text-strong)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--input-border)'; e.currentTarget.style.color = 'var(--text-normal)'; }}
        >
          <ArrowUpDown size={14} aria-hidden style={{ transition: 'transform 0.2s ease', transform: order === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </button>
      </div>

      {activeFilters.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {activeFilters.map((f) => (
            <span key={f.key} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--filter-chip-bg)',
              border: '1px solid var(--filter-chip-border)', borderRadius: 4, fontSize: 12, color: 'var(--text-normal)', padding: '2px 6px',
            }}>
              {f.label}
              <button
                onClick={f.remove}
                aria-label={`Remove filter ${f.label}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center' }}
              >×</button>
            </span>
          ))}
          <button
            onClick={() => onChange({ platforms: [], topics: [], difficulties: [], statuses: [], lists: [] })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 12, padding: 0 }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
