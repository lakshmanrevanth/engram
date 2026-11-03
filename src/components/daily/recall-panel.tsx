'use client';

import { format } from 'date-fns';
import { ExternalLink, Eye } from 'lucide-react';
import { getTopicColor } from '@/lib/topic-colors';
import { Pill } from '@/components/ui/pill';

const RATING_LABEL: Record<string, { label: string; color: string }> = {
  CLEAN: { label: 'Clean', color: '#34d399' },
  SHAKY: { label: 'Shaky', color: '#fbbf24' },
  STRUGGLED: { label: 'Struggled', color: '#f87171' },
};

type RecallPromptProps = {
  revealed: boolean;
  onReveal: () => void;
  /** Shown next to the button, e.g. a "Space" key hint in focus mode. */
  hint?: React.ReactNode;
};

/** Step 1 of recall-first review: think it through before looking at the notes. */
export function RecallPrompt({ revealed, onReveal, hint }: RecallPromptProps) {
  if (revealed) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, color: 'var(--text-normal)' }}>
        Try to recall your approach first: the key idea, the data structure, the edge cases.
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onReveal();
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 500,
          borderRadius: 6,
          background: 'var(--popover)',
          color: 'var(--foreground)',
          border: '1px solid var(--input-border)',
          cursor: 'pointer',
        }}
      >
        <Eye size={12} /> Reveal notes
      </button>
      {hint}
    </div>
  );
}

/** Step 2: the notes and history, shown after "Reveal notes". */
export function RecallDetails({ problem }: { problem: any }) {
  const topicColor = getTopicColor(problem.topic);
  const tags: string[] = Array.isArray(problem.tags) ? problem.tags : [];
  const last = problem.lastRating ? RATING_LABEL[problem.lastRating] : null;
  const lastDate = problem.lastRevisedAt ? new Date(problem.lastRevisedAt) : null;
  const notes = typeof problem.notes === 'string' ? problem.notes.trim() : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: notes ? 'var(--text-strong)' : 'var(--text-dim)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: 'var(--input-bg)',
          border: '1px solid var(--input-border)',
          borderRadius: 6,
          padding: '8px 12px',
          maxHeight: 260,
          overflowY: 'auto',
        }}
      >
        {notes || 'No notes yet. Add some from the problems table so the next review has something to check against.'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
        <Pill bg={topicColor.bg} text={topicColor.text} border={topicColor.border}>
          {problem.topic}
        </Pill>
        {tags.map((t) => (
          <span key={t} style={{ fontSize: 11.5, color: 'var(--text-normal)', border: '1px solid var(--input-border)', borderRadius: 4, padding: '1px 6px' }}>
            {t}
          </span>
        ))}
        <span>
          Reviewed {problem.revisionCount ?? 0} {problem.revisionCount === 1 ? 'time' : 'times'}
        </span>
        {last && (
          <span>
            · Last: <span style={{ color: last.color, fontWeight: 600 }}>{last.label}</span>
            {lastDate && !isNaN(lastDate.getTime()) ? ` on ${format(lastDate, 'MMM d')}` : ''}
          </span>
        )}
        {problem.url && (
          <a
            href={problem.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-normal)', textDecoration: 'underline' }}
          >
            Open problem <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
