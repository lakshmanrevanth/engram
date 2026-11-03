'use client';

import { useRef } from 'react';
import { PlatformLogo } from '@/lib/platforms/logos';
import { getDifficultyStyle } from './columns';
import { getTopicColor } from '@/lib/topic-colors';
import { Pill } from '@/components/ui/pill';
import { CustomCheckbox } from '@/components/ui/custom-checkbox';
import { StatusCell } from './row';
import { Star } from 'lucide-react';

type MobileRowProps = {
  problem: any;
  isSelected?: boolean;
  /** When any row is selected, a tap toggles selection instead of opening the problem. */
  selectionMode?: boolean;
  isHighlighted?: boolean;
  onToggleSelect?: (id: string) => void;
  onStarToggle: (id: string, current: boolean) => void;
};

const LONG_PRESS_MS = 500;

export function MobileRow({ problem, isSelected, selectionMode, isHighlighted, onToggleSelect, onStarToggle }: MobileRowProps) {
  const diffStyle = getDifficultyStyle(problem.difficulty);
  const topicColor = getTopicColor(problem.topic || '');
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    longPressed.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    cancelPress();
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onToggleSelect?.(problem.id);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(15);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    if (Math.abs(e.clientX - start.current.x) > 8 || Math.abs(e.clientY - start.current.y) > 8) cancelPress();
  };

  const handleClick = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    if (selectionMode) {
      onToggleSelect?.(problem.id);
      return;
    }
    if (problem.url) window.open(problem.url, '_blank', 'noopener,noreferrer');
  };

  const problemCode = typeof problem.problemNumber === 'number' && problem.problemNumber > 0
    ? String(problem.problemNumber)
    : (problem.code || '');

  return (
    <div
      id={`problem-row-${problem.id}`}
      className={isHighlighted ? 'animate-row-highlight' : undefined}
      role="button"
      tabIndex={0}
      aria-label={`${problem.title}${selectionMode ? (isSelected ? ', selected' : ', not selected') : ''}`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); if (e.key === ' ') { e.preventDefault(); onToggleSelect?.(problem.id); } }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        padding: '12px 16px 12px 8px',
        borderBottom: '1px solid var(--table-border)',
        background: isSelected ? 'var(--table-row-selected)' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 4,
        WebkitTouchCallout: 'none',
        userSelect: 'none',
        touchAction: 'manipulation',
      }}
    >
      {/* Always visible on touch: there is no hover to reveal it */}
      <div style={{ minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CustomCheckbox
          checked={!!isSelected}
          onChange={() => onToggleSelect?.(problem.id)}
          title={isSelected ? 'Deselect problem' : 'Select problem'}
          opacity={selectionMode || isSelected ? 1 : 0.55}
          size={18}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 32 }}>
          <PlatformLogo platform={problem.platform} size={18} />
          {problemCode && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-geist-mono), monospace', flexShrink: 0 }}>
              {problemCode}
            </span>
          )}
          <span
            style={{
              fontSize: 14, fontWeight: 500, color: 'var(--text-strong)', fontFamily: 'var(--font-geist-sans), sans-serif',
              flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {problem.title}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onStarToggle(problem.id, problem.isFavorite); }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={problem.isFavorite ? 'Remove bookmark' : 'Bookmark problem'}
            aria-pressed={!!problem.isFavorite}
            style={{
              background: 'none', border: 'none', padding: 4, minWidth: 32, minHeight: 32, display: 'flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <Star
              size={16}
              aria-hidden
              fill={problem.isFavorite ? '#eab308' : 'none'}
              color={problem.isFavorite ? '#eab308' : 'var(--star-icon-color)'}
            />
          </button>
        </div>

        <div style={{ marginTop: 4, marginLeft: 26, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10 }}>
            <Pill bg={diffStyle.bg} text={diffStyle.text} border={diffStyle.border}>
              {problem.difficulty ? problem.difficulty.charAt(0) + problem.difficulty.slice(1).toLowerCase() : '—'}
            </Pill>
          </span>
          {problem.topic && (
            <span style={{ fontSize: 10, minWidth: 0 }}>
              <Pill bg={topicColor.bg} text={topicColor.text} border={topicColor.border}>
                {problem.topic}
              </Pill>
            </span>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <StatusCell problem={problem} />
          </div>
        </div>
      </div>
    </div>
  );
}
