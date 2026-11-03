'use client';

import { startOfDay } from 'date-fns';
import { DifficultyPickerCell, TopicPickerCell, TableStyles } from './columns';
import { TagsCell } from './tag-input';
import { ProblemEditor, useProblemPatch, type ProblemPatch } from './problem-editor';
import { PlatformLogo } from '@/lib/platforms/logos';
import { displayCode } from '@/lib/platforms/problem-input';

import { useState, useRef, useEffect } from 'react';
import { CustomCheckbox } from '@/components/ui/custom-checkbox';
import { Bookmark, Pencil, SquarePen } from 'lucide-react';
import { CustomCell } from './custom-cell';
import { NextRevisionCell } from './next-revision-cell';

// Status dot + label — derives from problem.status and revisions[0].confidence
export function StatusCell({ problem }: { problem: any }) {
  if (problem.status === 'MASTERED') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div data-status-dot style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-mastered, var(--info))', flexShrink: 0 }} />
        <span data-status-label style={{ fontSize: 13, color: 'var(--status-mastered, var(--info))', fontFamily: 'var(--font-geist-mono), monospace' }}>Mastered</span>
      </div>
    );
  }
  if (problem.status === 'RETIRED') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div data-status-dot style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--muted-foreground)', flexShrink: 0 }} />
        <span data-status-label style={{ fontSize: 13, color: 'var(--muted-foreground)', fontFamily: 'var(--font-geist-mono), monospace' }}>Retired</span>
      </div>
    );
  }

  const latestConfidence = problem.revisions?.[0]?.confidence ?? null;

  if (!latestConfidence || problem.revisionCount === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div data-status-dot style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0 }} />
        <span data-status-label style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-geist-mono), monospace' }}>Not started</span>
      </div>
    );
  }

  if (latestConfidence === 'CLEAN') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div data-status-dot style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--easy-text)', flexShrink: 0 }} />
        <span data-status-label style={{ fontSize: 13, color: 'var(--easy-text)', fontFamily: 'var(--font-geist-mono), monospace' }}>Clean</span>
      </div>
    );
  }
  if (latestConfidence === 'SHAKY') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div data-status-dot style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--medium-text)', flexShrink: 0 }} />
        <span data-status-label style={{ fontSize: 13, color: 'var(--medium-text)', fontFamily: 'var(--font-geist-mono), monospace' }}>Shaky</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div data-status-dot style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--hard-text)', flexShrink: 0 }} />
      <span data-status-label style={{ fontSize: 13, color: 'var(--hard-text)', fontFamily: 'var(--font-geist-mono), monospace' }}>Struggled</span>
    </div>
  );
}

// Next revision formatted date string helper

// Star toggle — Lucide Star icon with golden glow & hover effect
function StarCell({ problem, onToggle }: { problem: any; onToggle: () => void }) {
  const [hovered, setHovered] = useState(false);
  const isFav = !!problem.isFavorite;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: hovered ? 'var(--star-btn-hover-bg)' : 'none',
          border: 'none',
          cursor: 'pointer',
          width: 28,
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          transition: 'all 0.15s ease',
        }}
        className="pt-focusable"
        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        aria-label={isFav ? 'Remove bookmark' : 'Bookmark'}
        aria-pressed={isFav}
      >
        <Bookmark
          size={15}
          fill={isFav ? 'var(--foreground)' : 'none'}
          color={isFav ? 'var(--foreground)' : hovered ? 'var(--star-icon-hover)' : 'var(--star-icon-color)'}
          style={{
            transition: 'transform 0.15s ease, color 0.15s ease, fill 0.15s ease',
            transform: hovered ? 'scale(1.15)' : 'scale(1)',
          }}
        />
      </button>
    </div>
  );
}

// Notion-style inline editable cell for Notes and Custom Fields using a floating popover editor
function InlineEditCell({
  initialValue = '',
  maxWidth = 180,
  label = 'Edit',
  onSave,
}: {
  initialValue?: string;
  maxWidth?: number;
  label?: string;
  onSave: (val: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState(initialValue ?? '');
  const [hovered, setHovered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const isCommittingRef = useRef(false);

  useEffect(() => {
    if (!editing && !saving) {
      setValue(initialValue ?? '');
    }
  }, [initialValue, editing, saving]);

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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleCommit(value);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editing, value]);

  const handleInput = () => {
    if (textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  const handleCommit = async (valToSave: string) => {
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;
    const trimmed = valToSave.trim();
    const original = (initialValue ?? '').trim();

    setEditing(false);

    if (trimmed !== original) {
      setSaving(true);
      try {
        await onSave(trimmed);
      } catch {
        setValue(initialValue ?? '');
      } finally {
        setSaving(false);
        isCommittingRef.current = false;
      }
    } else {
      isCommittingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommit(value);
      displayRef.current?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      isCommittingRef.current = true;
      setValue(initialValue ?? '');
      setEditing(false);
      displayRef.current?.focus();
      setTimeout(() => {
        isCommittingRef.current = false;
      }, 50);
    }
  };

  const displayText = (value ?? '').trim();
  const truncated = displayText.length > 40 ? displayText.slice(0, 40) + '…' : displayText;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Display mode cell */}
      <div
        ref={displayRef}
        role="button"
        tabIndex={0}
        className="pt-focusable"
        aria-label={displayText ? `${label}: ${displayText}` : label}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (!editing && (e.key === 'Enter' || e.key === 'F2')) {
            e.preventDefault();
            setEditing(true);
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={displayText ? displayText : undefined}
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          cursor: 'text',
          minHeight: 26,
          padding: '3px 6px',
          borderRadius: 4,
          background: hovered ? 'var(--table-inline-edit-hover)' : 'transparent',
          opacity: saving ? 0.6 : 1,
          transition: 'background 0.15s ease, opacity 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            maxWidth: maxWidth - 24,
          }}
        >
          {truncated}
        </span>
        {hovered && (
          <Pencil
            size={12}
            style={{ color: 'var(--text-faint)', flexShrink: 0, marginLeft: 4 }}
          />
        )}
      </div>

      {/* Floating notion-style popover editor */}
      {editing && (
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            top: -4,
            left: -4,
            width: 'max(100% + 8px, 240px)',
            zIndex: 100,
            background: 'var(--popover)',
            border: '1px solid var(--input-border)',
            borderRadius: 6,
            padding: '8px 10px',
            boxShadow: 'var(--shadow-popover)',
            opacity: saving ? 0.6 : 1,
            transition: 'opacity 0.15s ease',
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            aria-label={label}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--foreground)',
              fontSize: 13,
              fontFamily: 'inherit',
              lineHeight: '1.4',
              resize: 'none',
              overflow: 'hidden',
              padding: 0,
              margin: 0,
              display: 'block',
              boxSizing: 'border-box',
              caretColor: 'var(--foreground)',
            }}
          />
        </div>
      )}
    </div>
  );
}

type ProblemRowProps = {
  problem: any;
  columns: any[];
  isSelected: boolean;
  isHighlighted?: boolean;
  onToggleSelect: (id: string) => void;
  onStarToggle: (id: string, current: boolean) => void;
  onDifficultySave: (id: string, difficulty: string) => Promise<void> | void;
  onTopicSave: (id: string, topic: string) => Promise<void> | void;
  onNotesSave: (id: string, notes: string) => Promise<void> | void;
  onCustomFieldSave: (id: string, columnName: string, value: string) => Promise<void> | void;
  /** Saves tags; defaults to onProblemUpdate / a built-in optimistic PATCH. */
  onTagsSave?: (id: string, tags: string[]) => Promise<void> | void;
  /** Generic edit (editor panel). Should throw on failure; defaults to a built-in optimistic PATCH. */
  onProblemUpdate?: (id: string, patch: ProblemPatch) => Promise<void>;
  /** Scroll to + highlight another row (used for "already tracked" conflicts). */
  onJumpToProblem?: (id: string) => void;
  /** Delete this row (shown in the edit panel). */
  onDelete?: (id: string) => void;
  /** User's own topics / tags; derived from the cached problem list when omitted. */
  topicSuggestions?: string[];
  tagSuggestions?: string[];
};

export function ProblemRow({
  problem, columns, isSelected, isHighlighted, onToggleSelect, onStarToggle, onDifficultySave, onTopicSave,
  onNotesSave, onCustomFieldSave, onTagsSave, onProblemUpdate, onJumpToProblem, onDelete, topicSuggestions, tagSuggestions,
}: ProblemRowProps) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const builtInPatch = useProblemPatch();
  const update = onProblemUpdate ?? builtInPatch;
  const saveTags = (tags: string[]) => (onTagsSave ? onTagsSave(problem.id, tags) : update(problem.id, { tags }));
  const tags: string[] = Array.isArray(problem.tags) ? problem.tags : [];

  const code = problem.platform === 'CODEFORCES' || problem.platform === 'CODECHEF' ? displayCode(problem) : null;
  const numberLabel = code
    ?? (problem.platform === 'LEETCODE' && problem.problemNumber > 0 && problem.problemNumber < 100000 ? String(problem.problemNumber) : null);

  return (
    <tr
      id={`problem-row-${problem.id}`}
      className={`pt-row${isHighlighted ? ' animate-row-highlight' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isSelected ? 'var(--table-row-selected)' : hovered ? 'var(--table-row-hover)' : 'transparent',
        borderBottom: '1px solid var(--table-border)',
        height: 44,
        transition: 'background 0.1s',
      }}
    >
      {/* Checkbox cell — always visible on touch; on hover/focus with a mouse */}
      <td data-cell="checkbox" style={{ width: 36, textAlign: 'center', padding: '0 4px' }}>
        <TableStyles />
        <div className="pt-reveal" data-active={isSelected} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CustomCheckbox
            checked={isSelected}
            onChange={() => onToggleSelect(problem.id)}
            title={`Select ${problem.title}`}
          />
        </div>
      </td>

      {/* Platform logo cell */}
      <td data-cell="platform" style={{ width: 40, textAlign: 'center', padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PlatformLogo platform={problem.platform} />
        </div>
      </td>

      {/* Problem cell: number/code + title + edit */}
      <td data-cell="problem" style={{ width: 340, padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
          {numberLabel && (
            <span data-problem-code style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 13, color: 'var(--text-muted)', fontWeight: 400, flexShrink: 0 }}>
              {numberLabel}
            </span>
          )}
          {problem.url ? (
            <a
              data-problem-title
              href={problem.url}
              target="_blank"
              rel="noopener noreferrer"
              title={problem.title}
              className="pt-focusable"
              style={{
                fontSize: 14,
                color: 'var(--text-strong)',
                fontWeight: 500,
                textDecoration: hovered ? 'underline' : 'none',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {problem.title}
            </a>
          ) : (
            <span style={{ fontSize: 14, color: 'var(--text-strong)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={problem.title}>
              {problem.title}
              <span style={{ color: 'var(--text-faint)', fontSize: 12, textDecoration: 'line-through', flexShrink: 0 }}>🔗</span>
            </span>
          )}
          <button
            type="button"
            data-edit-problem
            className="pt-focusable pt-reveal"
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            aria-label={`Edit ${problem.title}`}
            title="Edit title, URL, solve date…"
            style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--text-faint)', display: 'inline-flex', flexShrink: 0, marginLeft: 'auto' }}
          >
            <SquarePen size={13} />
          </button>
        </div>
        {editing && (
          <ProblemEditor
            problem={problem}
            onClose={() => setEditing(false)}
            onSave={update}
            onJumpToProblem={onJumpToProblem}
            onDelete={onDelete}
          />
        )}
      </td>

      {/* Difficulty */}
      <td data-cell="difficulty" style={{ width: 115, padding: '0 12px', position: 'relative' }}>
        <DifficultyPickerCell
          difficulty={problem.difficulty}
          onSave={(newDiff) => onDifficultySave(problem.id, newDiff)}
        />
      </td>

      {/* Topic (primary) + tags */}
      <td data-cell="topic" style={{ width: 185, padding: '0 12px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ minWidth: 0, flexShrink: 1 }}>
            <TopicPickerCell
              topic={problem.topic}
              suggestions={topicSuggestions}
              onSave={(newTopic) => onTopicSave(problem.id, newTopic)}
            />
          </div>
          <TagsCell tags={tags} suggestions={tagSuggestions} onSave={saveTags} />
        </div>
      </td>

      {/* Status */}
      <td data-cell="status" style={{ width: 140, padding: '0 12px' }}>
        <StatusCell problem={problem} />
      </td>

      {/* Star */}
      <td data-cell="star" data-col="star" style={{ width: 44, textAlign: 'center', padding: 0 }}>
        <StarCell problem={problem} onToggle={() => onStarToggle(problem.id, problem.isFavorite)} />
      </td>

      {/* Next Revision */}
      <td data-cell="next-revision" data-col="next-revision" style={{ width: 140, padding: '0 12px' }}>
        <NextRevisionCell problem={problem} onSave={(key) => update(problem.id, { nextRevisionOn: key })} />
      </td>

      {/* Notes — Notion-style in-place editable */}
      <td data-cell="notes" data-col="notes" style={{ width: 190, padding: '0 12px' }}>
        <InlineEditCell
          initialValue={problem.notes ?? ''}
          maxWidth={190}
          label="Notes"
          onSave={(val) => onNotesSave(problem.id, val)}
        />
      </td>

      {/* Custom columns — Notion-style in-place editable */}
      {columns.map((col) => {
        const fields = (problem.customFields as Record<string, string>) ?? {};
        return (
          <td key={col.id} data-cell="custom" data-col="custom" style={{ width: 140, padding: '0 8px' }}>
            <CustomCell
              column={col}
              value={fields[col.name]}
              width={140}
              onSave={(val) => onCustomFieldSave(problem.id, col.name, val)}
            />
          </td>
        );
      })}

      {/* Trailing cell for Add Column column alignment */}
      <td data-cell="custom" data-col="custom" style={{ width: 100 }} />
    </tr>
  );
}
