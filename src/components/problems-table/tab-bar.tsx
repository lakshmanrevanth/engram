'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Bookmark, ListChecks } from 'lucide-react';

/** 'all' | 'due' | 'bookmarked' | `list:<id>` */
export type TabKey = string;

type TabBarProps = {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
  lists?: { id: string; name: string; count: number }[];
  dueCount?: number;
  /** Rendered after the tabs (e.g. the Lists menu). */
  trailing?: ReactNode;
};

type Tab = { key: TabKey; label: string; icon?: ReactNode; count?: number };

export function TabBar({ activeTab, onChange, lists = [], dueCount, trailing }: TabBarProps) {
  const tabs: Tab[] = [
    { key: 'all', label: 'All Problems' },
    { key: 'due', label: 'Due Today', count: dueCount },
    { key: 'bookmarked', label: 'Bookmarked', icon: <Bookmark size={14} fill={activeTab === 'bookmarked' ? 'currentColor' : 'none'} /> },
    ...lists.map((l) => ({ key: `list:${l.id}`, label: l.name, icon: <ListChecks size={14} />, count: l.count })),
  ];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === activeTab));

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(tabs[next].key);
  };

  return (
    <div data-tab-bar-wrapper style={{ position: 'relative', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--daily-card-border)' }}>
      <div
        data-table-tabs
        data-tab-bar
        role="tablist"
        aria-label="Problem views"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          flex: 1,
          minWidth: 0,
        }}
      >
        {tabs.map((tab, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={tab.key}
              ref={(el) => { refs.current[i] = el; }}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              data-tab-item
              data-active={isActive ? 'true' : 'false'}
              onClick={() => onChange(tab.key)}
              onKeyDown={(e) => onKeyDown(e, i)}
              title={tab.label}
              style={{
                background: 'none',
                border: 'none',
                boxShadow: isActive ? 'inset 0 -2px 0 var(--foreground)' : 'none',
                color: isActive ? 'var(--foreground)' : 'var(--text-subtle)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                padding: tab.key === 'bookmarked' ? '8px 10px' : '8px 14px',
                margin: '0 2px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, box-shadow 0.15s',
                maxWidth: 220,
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--foreground)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-subtle)'; }}
            >
              {tab.icon}
              {tab.key === 'bookmarked' ? (
                <span className="sr-only">{tab.label}</span>
              ) : (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.label}</span>
              )}
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  aria-label={`${tab.count} problems`}
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-geist-mono), monospace',
                    color: 'var(--text-muted)',
                    background: 'var(--secondary)',
                    borderRadius: 4,
                    padding: '0 5px',
                    lineHeight: '16px',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {trailing && <div style={{ flexShrink: 0, paddingLeft: 6 }}>{trailing}</div>}
    </div>
  );
}
