'use client';

import { RecallQuestions } from './recall-questions';
import { useId, useState } from 'react';
import { ExternalLink, ChevronRight } from 'lucide-react';
import { getDifficultyStyle } from '@/components/problems-table/columns';
import { getTopicColor } from '@/lib/topic-colors';
import { Pill } from '@/components/ui/pill';
import { PlatformLogo } from '@/lib/platforms/logos';
import { nextIntervalLabel, describeInterval, CONFIDENCES, type Confidence } from './intervals';
import { RowMenu } from './row-menu';
import { RecallPrompt, RecallDetails } from './recall-panel';

export { nextIntervalLabel };

type ProblemRowProps = {
  problem: any;
  /** The user's review intervals, for the "next review" labels. */
  ladder?: readonly number[];
  /** Rating being saved for this row, if any. */
  pendingConf?: Confidence | null;
  /** Roving tabindex: only the focused row is in the tab order. */
  focused?: boolean;
  onRate: (problem: any, conf: Confidence) => void;
  onSnooze?: (problem: any, days: number) => void;
  onRetire?: (problem: any) => void;
  onFocusRow?: (id: string) => void;
};

export const CONF_BUTTONS: Record<
  Confidence,
  { label: string; hint: string; hoverBg: string; hoverBorder: string; hoverText: string }
> = {
  CLEAN: { label: 'Clean', hint: 'Advance', hoverBg: 'rgba(16, 185, 129, 0.12)', hoverBorder: '#10b981', hoverText: '#34d399' },
  SHAKY: { label: 'Shaky', hint: 'Repeat', hoverBg: 'rgba(245, 158, 11, 0.12)', hoverBorder: '#f59e0b', hoverText: '#fbbf24' },
  STRUGGLED: { label: 'Struggled', hint: 'Reset', hoverBg: 'rgba(248, 113, 113, 0.12)', hoverBorder: '#f87171', hoverText: '#f87171' },
};

const isInteractive = (el: EventTarget | null) =>
  !!(el as HTMLElement | null)?.closest?.('a, button, input, textarea, select, [role="menu"]');

export function ProblemRevisionRow({
  problem,
  ladder,
  pendingConf = null,
  focused = false,
  onRate,
  onSnooze,
  onRetire,
  onFocusRow,
}: ProblemRowProps) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const panelId = useId();

  const diffStyle = getDifficultyStyle(problem.difficulty);
  const topicColor = getTopicColor(problem.topic);
  const saving = pendingConf !== null;

  const toggle = () => setExpanded((v) => !v);

  const menuItems = [
    { key: 's1', label: 'Snooze 1 day', onSelect: () => onSnooze?.(problem, 1) },
    { key: 's3', label: 'Snooze 3 days', onSelect: () => onSnooze?.(problem, 3) },
    { key: 's7', label: 'Snooze 1 week', onSelect: () => onSnooze?.(problem, 7) },
    { key: 'retire', label: 'Retire', danger: true, separatorBefore: true, onSelect: () => onRetire?.(problem) },
    ...(problem.url ? [{ key: 'open', label: 'Open problem', href: problem.url as string }] : []),
  ];

  return (
    <div
      data-row-id={problem.id}
      role="group"
      aria-label={problem.title}
      tabIndex={focused ? 0 : -1}
      onFocus={() => onFocusRow?.(problem.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        } else if (e.key === 'Escape' && expanded) {
          setExpanded(false);
        }
      }}
      style={{
        position: 'relative',
        background: hovered || expanded ? 'var(--input-bg)' : 'var(--daily-card-bg)',
        borderBottom: '1px solid var(--table-border)',
        transition: 'background 0.12s ease',
        outline: 'none',
      }}
    >
      <div
        className="rc-daily-grid rc-daily-row"
        data-expandable="true"
        onClick={(e) => {
          if (!isInteractive(e.target)) toggle();
        }}
      >
        {/* 1. ID / Number */}
        <div className="rc-cell-id" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <PlatformLogo platform={problem.platform ?? 'LEETCODE'} size={19} padding={1} />
          {(problem.platform === 'LEETCODE' || problem.platform === 'CODEFORCES') && (problem.problemNumber ?? 0) > 0 && (
            <span style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 12, color: 'var(--text-dim)' }}>
              {problem.problemNumber}
            </span>
          )}
        </div>

        {/* 2. Title + expand toggle */}
        <div className="rc-cell-title" style={{ paddingRight: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={expanded ? `Hide recall panel for ${problem.title}` : `Recall first: show notes panel for ${problem.title}`}
            title={expanded ? 'Hide' : 'Recall first, then reveal your notes'}
            onClick={toggle}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              padding: 0,
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--text-subtle)',
              cursor: 'pointer',
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.12s ease',
            }}
          >
            <ChevronRight size={14} />
          </button>
          <span
            className="rc-title"
            title={problem.title}
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: 'var(--text-strong)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {problem.title}
          </span>
          {problem.isRecheck && (
            <span
              title="Mastered problem back for a long-term check"
              style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)', border: '1px solid var(--input-border)', borderRadius: 4, padding: '1px 6px' }}
            >
              Recheck
            </span>
          )}
          {(problem.daysOverdue ?? 0) > 0 && (
            <span
              title={`Was due ${problem.daysOverdue} day${problem.daysOverdue === 1 ? '' : 's'} ago`}
              style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 600, color: '#f87171', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 4, padding: '1px 6px' }}
            >
              {problem.daysOverdue}d late
            </span>
          )}
        </div>

        {/* 3–4. Difficulty + topic (one chip row on small screens) */}
        <div className="rc-cell-chips">
          <div>
            <Pill bg={diffStyle.bg} text={diffStyle.text} border={diffStyle.border}>
              {problem.difficulty.charAt(0) + problem.difficulty.slice(1).toLowerCase()}
            </Pill>
          </div>
          <div>
            <Pill bg={topicColor.bg} text={topicColor.text} border={topicColor.border}>
              {problem.topic}
            </Pill>
          </div>
        </div>

        {/* 5. Rating buttons */}
        <div className="rc-cell-rate">
          <div className="rc-rate-buttons" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {CONFIDENCES.map((conf, i) => {
              const cfg = CONF_BUTTONS[conf];
              const next = nextIntervalLabel(problem, conf, ladder);
              return (
                <button
                  key={conf}
                  type="button"
                  onClick={() => onRate(problem, conf)}
                  disabled={saving}
                  aria-keyshortcuts={String(i + 1)}
                  aria-label={`Rate ${problem.title} as ${cfg.label}${next ? `, ${next === 'mastered' ? 'marks it mastered' : `next review in ${next}`}` : ''}`}
                  title={`${cfg.hint}${next ? ` · ${describeInterval(next)}` : ''} (${i + 1})`}
                  style={{
                    background: 'var(--popover)',
                    border: '1px solid var(--input-border)',
                    borderRadius: 6,
                    color: pendingConf === conf ? 'var(--text-subtle)' : 'var(--text-normal)',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '4px 10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    boxShadow: 'var(--shadow-popover)',
                    transition: 'all 0.12s ease-in-out',
                  }}
                  onMouseEnter={(e) => {
                    if (!saving) {
                      e.currentTarget.style.background = cfg.hoverBg;
                      e.currentTarget.style.borderColor = cfg.hoverBorder;
                      e.currentTarget.style.color = cfg.hoverText;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--popover)';
                    e.currentTarget.style.borderColor = 'var(--input-border)';
                    e.currentTarget.style.color = 'var(--text-normal)';
                  }}
                >
                  {pendingConf === conf ? 'Saving…' : cfg.label}
                  {pendingConf !== conf && next && (
                    <span style={{ fontSize: 10.5, opacity: 0.6, fontFamily: 'var(--font-geist-mono), monospace' }}>
                      {next === 'mastered' ? '✓' : next}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. Link + more menu */}
        <div className="rc-cell-more" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
          {problem.url && (
            <a
              href={problem.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open problem in new tab"
              aria-label={`Open ${problem.title} in a new tab`}
              style={{ color: 'var(--text-subtle)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 4 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
            >
              <ExternalLink size={14} />
            </a>
          )}
          {(onSnooze || onRetire) && <RowMenu items={menuItems} label={`More actions for ${problem.title}`} disabled={saving} />}
        </div>
      </div>

      {/* Recall-first panel: prompt → reveal notes → rate */}
      {expanded && (
        <div id={panelId} className="rc-recall-panel">
          {!revealed && <RecallQuestions problem={problem} />}
          <RecallPrompt revealed={revealed} onReveal={() => setRevealed(true)} />
          {revealed && (
            <>
              <RecallDetails problem={problem} />
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-dim)' }}>
                How did it go? Rate it with the buttons above, or press <kbd className="rc-kbd">1</kbd> <kbd className="rc-kbd">2</kbd> <kbd className="rc-kbd">3</kbd>.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
