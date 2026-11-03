import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getTopicColor } from '@/lib/topic-colors';
import { Pill } from '@/components/ui/pill';
import { mergeSuggestions, topicsFrom, useCachedProblems } from './suggestions';

export function getDifficultyStyle(difficulty: string): { bg: string; text: string; border: string } {
  switch (difficulty) {
    case 'EASY':   return { bg: 'var(--easy-bg, #1c3a1c)', text: 'var(--easy-text, #4ade80)', border: 'var(--easy-border, #2d5a2d)' };
    case 'MEDIUM': return { bg: 'var(--medium-bg, #3a2a0d)', text: 'var(--medium-text, #fb923c)', border: 'var(--medium-border, #5a3d10)' };
    case 'HARD':   return { bg: 'var(--hard-bg, #3a0f0f)', text: 'var(--hard-text, #f87171)', border: 'var(--hard-border, #5a1a1a)' };
    default:       return { bg: 'var(--secondary, #1a1a1a)', text: 'var(--text-dim, #888)', border: 'var(--border, #2a2a2a)' };
  }
}

// Shared table styles that inline styles can't express (focus rings, hover-only reveal).
// React 19 hoists and dedupes <style href precedence> into <head>.
const TABLE_CSS = `
.pt-focusable:focus-visible { outline: 2px solid var(--ring); outline-offset: 1px; border-radius: 4px; }
.pt-reveal { opacity: 1; }
@media (hover: hover) and (pointer: fine) {
  .pt-row .pt-reveal { opacity: 0; transition: opacity 0.12s ease; }
  .pt-row:hover .pt-reveal, .pt-row:focus-within .pt-reveal, .pt-row .pt-reveal[data-active="true"] { opacity: 1; }
}
.pt-input { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px; color: var(--text-strong); font-size: 13px; padding: 5px 8px; outline: none; font-family: inherit; box-sizing: border-box; }
.pt-input:focus { border-color: var(--input-focus-border, var(--ring)); }
.pt-input[aria-invalid="true"] { border-color: var(--error-border); }
`;

export function TableStyles() {
  return (
    <style href="problems-table-a11y" precedence="default">
      {TABLE_CSS}
    </style>
  );
}

// TopLevelPortal — renders any table pop up at root document.body level (zIndex: 99999)
// so it overflows table barriers and is never clipped by table overflow/headers.
// Esc closes and returns focus to the anchor; ↑/↓ move between [data-option] buttons.
export function TopLevelPortal({
  anchorRef,
  onClose,
  children,
  width = 160,
  minHeight = 120,
  label,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  minHeight?: number;
  label?: string;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const updatePosition = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const popupH = popoverRef.current?.offsetHeight ?? minHeight;
      const popupW = popoverRef.current?.offsetWidth ?? width;

      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < popupH && rect.top > popupH;

      let top = openUpward ? rect.top - popupH - 4 : rect.bottom + 4;
      let left = rect.left;

      if (top < 8) top = 8;
      if (top + popupH > window.innerHeight - 8) top = window.innerHeight - popupH - 8;
      if (left + popupW > window.innerWidth - 12) left = window.innerWidth - popupW - 12;
      if (left < 8) left = 8;

      setPos({ top, left });
    };

    updatePosition();
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onCloseRef.current();
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 10);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [anchorRef, width, minHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCloseRef.current();
      anchorRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const options = Array.from(popoverRef.current?.querySelectorAll<HTMLElement>('[data-option]') ?? []);
      if (!options.length) return;
      e.preventDefault();
      const i = options.indexOf(document.activeElement as HTMLElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % options.length : (i <= 0 ? options.length - 1 : i - 1);
      options[next].focus();
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popoverRef}
      data-portal="true"
      role="dialog"
      aria-label={label}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 99999,
        background: 'var(--popover)',
        border: '1px solid var(--input-border)',
        borderRadius: 8,
        padding: 6,
        boxShadow: 'var(--shadow-modal)',
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body
  );
}

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
const label = (d: string) => (d ? d.charAt(0) + d.slice(1).toLowerCase() : '');

const triggerStyle = (saving: boolean): React.CSSProperties => ({
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  opacity: saving ? 0.6 : 1,
  transition: 'opacity 0.15s ease',
  display: 'inline-flex',
  maxWidth: '100%',
});

export function DifficultyPickerCell({
  difficulty,
  onSave,
}: {
  difficulty: string;
  onSave: (val: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hoveredOpt, setHoveredOpt] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const opts = listRef.current?.querySelectorAll<HTMLElement>('[data-option]');
      const selected = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      (selected ?? opts?.[0])?.focus();
    }, 20);
    return () => clearTimeout(t);
  }, [open]);

  const handleSelect = async (newDiff: string) => {
    setOpen(false);
    buttonRef.current?.focus();
    if (newDiff === difficulty) return;
    setSaving(true);
    try {
      await onSave(newDiff);
    } catch {
      // Revert handled by parent/SWR
    } finally {
      setSaving(false);
    }
  };

  const diffStyle = getDifficultyStyle(difficulty);

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        type="button"
        data-difficulty-pill
        ref={buttonRef}
        className="pt-focusable"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        title="Change difficulty"
        aria-label={difficulty ? `Difficulty: ${label(difficulty)}. Change difficulty` : 'Select difficulty'}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={triggerStyle(saving)}
      >
        <Pill bg={diffStyle.bg} text={diffStyle.text} border={diffStyle.border}>
          {difficulty ? label(difficulty) : 'Select'}
        </Pill>
      </button>

      {open && (
        <TopLevelPortal anchorRef={buttonRef} onClose={() => setOpen(false)} width={120} label="Difficulty">
          <div ref={listRef} role="listbox" aria-label="Difficulty" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {DIFFICULTIES.map((d) => {
              const st = getDifficultyStyle(d);
              const isSelected = d === difficulty;
              const isHovered = hoveredOpt === d;
              return (
                <button
                  type="button"
                  key={d}
                  data-option
                  role="option"
                  aria-selected={isSelected}
                  className="pt-focusable"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(d);
                  }}
                  onMouseEnter={() => setHoveredOpt(d)}
                  onMouseLeave={() => setHoveredOpt(null)}
                  style={{
                    background: isHovered ? 'var(--dropdown-item-hover-bg)' : 'none',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <Pill bg={st.bg} text={st.text} border={st.border}>
                    {label(d)}
                  </Pill>
                  {isSelected && <span aria-hidden style={{ color: 'var(--foreground)', fontSize: 12, marginLeft: 8 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </TopLevelPortal>
      )}
    </div>
  );
}

export const DEFAULT_TOPICS = [
  'Array',
  'String',
  'Hash Table',
  'Two Pointers',
  'Sliding Window',
  'Binary Search',
  'Linked List',
  'Stack',
  'Queue',
  'Tree',
  'Binary Tree',
  'Binary Search Tree',
  'Graph',
  'Heap / Priority Queue',
  'Dynamic Programming',
  'Greedy',
  'Backtracking',
  'Trie',
  'Bit Manipulation',
  'Union Find',
  'Matrix',
  'Math',
  'Recursion',
  'Sorting',
];

export function TopicPickerCell({
  topic,
  onSave,
  suggestions,
}: {
  topic: string;
  onSave: (val: string) => Promise<void> | void;
  /** The user's own topics; derived from the cached problem list when omitted. */
  suggestions?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleSelect = async (newTopic: string) => {
    setOpen(false);
    buttonRef.current?.focus();
    if (newTopic === topic) return;
    setSaving(true);
    try {
      await onSave(newTopic);
    } catch {
      // Revert handled by parent/SWR
    } finally {
      setSaving(false);
    }
  };

  const topicColor = getTopicColor(topic || '');

  return (
    <div style={{ display: 'inline-block', maxWidth: '100%' }}>
      <button
        type="button"
        data-topic-pill
        ref={buttonRef}
        className="pt-focusable"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        title="Change topic"
        aria-label={topic ? `Topic: ${topic}. Change topic` : 'Set topic'}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={triggerStyle(saving)}
      >
        <Pill bg={topicColor.bg} text={topicColor.text} border={topicColor.border}>
          {topic || '—'}
        </Pill>
      </button>

      {open && (
        <TopLevelPortal anchorRef={buttonRef} onClose={() => setOpen(false)} width={220} minHeight={200} label="Topic">
          <TopicOptions topic={topic} suggestions={suggestions} onSelect={handleSelect} onClose={() => setOpen(false)} />
        </TopLevelPortal>
      )}
    </div>
  );
}

// Mounted only while the picker is open, so the cache subscription is short-lived.
function TopicOptions({
  topic,
  suggestions,
  onSelect,
  onClose,
}: {
  topic: string;
  suggestions?: string[];
  onSelect: (t: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [hoveredOpt, setHoveredOpt] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cached = useCachedProblems();

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const userTopics = suggestions ?? topicsFrom(cached);
  const all = mergeSuggestions(userTopics, DEFAULT_TOPICS);
  const query = search.trim().toLowerCase();
  const filtered = all.filter((t) => t.toLowerCase().includes(query));
  const exact = all.find((t) => t.toLowerCase() === query);
  const showCreateOption = query.length > 0 && !exact && topic.toLowerCase() !== query;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 208 }}>
      <input
        ref={inputRef}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && search.trim()) {
            e.preventDefault();
            e.stopPropagation();
            // Reuse an existing spelling ("dp" → "DP") to avoid fragmenting topics.
            onSelect(exact ?? search.trim());
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.currentTarget.parentElement?.querySelector<HTMLElement>('[data-option]')?.focus();
          }
        }}
        placeholder="Search or add topic..."
        aria-label="Search or add topic"
        style={{
          background: 'var(--input-bg)',
          border: '1px solid var(--input-border)',
          borderRadius: 4,
          color: 'var(--foreground)',
          fontSize: 12,
          padding: '5px 8px',
          width: '100%',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      <div role="listbox" aria-label="Topics" style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {showCreateOption && (
          <button
            type="button"
            data-option
            className="pt-focusable"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(search.trim());
            }}
            onMouseEnter={() => setHoveredOpt('__create__')}
            onMouseLeave={() => setHoveredOpt(null)}
            style={{
              background: hoveredOpt === '__create__' ? 'var(--success-bg)' : 'none',
              border: '1px dashed var(--success-border)',
              borderRadius: 4,
              padding: '6px 8px',
              cursor: 'pointer',
              color: 'var(--success)',
              fontSize: 12,
              textAlign: 'left',
              fontWeight: 500,
            }}
          >
            Create &quot;{search.trim()}&quot;
          </button>
        )}

        {filtered.map((t) => {
          const tc = getTopicColor(t);
          const isSelected = t === topic;
          const isHovered = hoveredOpt === t;
          return (
            <button
              type="button"
              key={t}
              data-option
              role="option"
              aria-selected={isSelected}
              className="pt-focusable"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(t);
              }}
              onMouseEnter={() => setHoveredOpt(t)}
              onMouseLeave={() => setHoveredOpt(null)}
              style={{
                background: isHovered ? 'var(--dropdown-item-hover-bg)' : 'none',
                border: 'none',
                borderRadius: 4,
                padding: '5px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <Pill bg={tc.bg} text={tc.text} border={tc.border}>
                {t}
              </Pill>
              {isSelected && <span aria-hidden style={{ color: 'var(--foreground)', fontSize: 12 }}>✓</span>}
            </button>
          );
        })}

        {filtered.length === 0 && !showCreateOption && (
          <div style={{ padding: 8, fontSize: 12, color: 'var(--text-subtle)', textAlign: 'center' }}>
            No matching topics
          </div>
        )}
      </div>
    </div>
  );
}
