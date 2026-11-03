'use client';

import { RecallQuestions } from './recall-questions';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ExternalLink, Layers } from 'lucide-react';
import { getDifficultyStyle } from '@/components/problems-table/columns';
import { getTopicColor } from '@/lib/topic-colors';
import { Pill } from '@/components/ui/pill';
import { PlatformLogo } from '@/lib/platforms/logos';
import { nextIntervalLabel, describeInterval, CONFIDENCES, type Confidence } from './intervals';
import { isPlainShortcut, RATING_KEYS } from './keyboard';
import { RecallPrompt, RecallDetails } from './recall-panel';

type FocusDeckProps = {
  /** Unrated due problems, weakest first. The first one is the current card. */
  problems: any[];
  ladder?: readonly number[];
  pendingConf?: Confidence | null;
  onRate: (problem: any, conf: Confidence) => void;
  onSnooze: (problem: any, days: number) => void;
  onUndo: () => void;
  onExit: () => void;
};

const CARD_COLORS: Record<Confidence, { label: string; text: string; bg: string; bgHover: string; border: string }> = {
  CLEAN: { label: 'Clean', text: '#34d399', bg: 'rgba(16, 185, 129, 0.08)', bgHover: 'rgba(16, 185, 129, 0.18)', border: 'rgba(16, 185, 129, 0.3)' },
  SHAKY: { label: 'Shaky', text: '#fbbf24', bg: 'rgba(245, 158, 11, 0.08)', bgHover: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.3)' },
  STRUGGLED: { label: 'Struggled', text: '#f87171', bg: 'rgba(248, 113, 113, 0.08)', bgHover: 'rgba(248, 113, 113, 0.18)', border: 'rgba(248, 113, 113, 0.3)' },
};

/** One card at a time: 1/2/3 rate, Space reveals notes, S snoozes a day, U undoes, Esc exits. */
export function FocusDeck({ problems, ladder, pendingConf = null, onRate, onSnooze, onUndo, onExit }: FocusDeckProps) {
  const [initialTotal] = useState(problems.length);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const current = problems[0];
  // An undo can put a card back, so the total never shrinks below what's left.
  const total = Math.max(initialTotal, problems.length);
  const done = total - problems.length;
  const revealed = !!current && revealedId === current.id;

  useEffect(() => {
    cardRef.current?.focus();
  }, [current?.id]);

  // Latest values for the key handler without re-binding it on every render.
  const latest = useRef({ current, revealed, pendingConf, onRate, onSnooze, onUndo, onExit });
  useEffect(() => {
    latest.current = { current, revealed, pendingConf, onRate, onSnooze, onUndo, onExit };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPlainShortcut(e) || e.repeat) return;
      const s = latest.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        s.onExit();
        return;
      }
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        s.onUndo();
        return;
      }
      if (!s.current || s.pendingConf) return;
      const conf = RATING_KEYS[e.key];
      if (conf) {
        e.preventDefault();
        s.onRate(s.current, conf);
      } else if (e.key === ' ') {
        // Space on a focused button should still press it.
        if ((e.target as HTMLElement)?.closest?.('button, a')) return;
        e.preventDefault();
        setRevealedId(s.current.id);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        s.onSnooze(s.current, 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const progressPct = total > 0 ? Math.round((done / total) * 100) : 100;

  return (
    <section aria-label="Focus mode" style={{ maxWidth: 680, margin: '0 auto', padding: '4px 0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} style={{ color: 'var(--text-muted)' }} />
          <span aria-live="polite" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-normal)' }}>
            {current ? `Card ${Math.min(done + 1, total)} of ${total}` : `${done} of ${total} reviewed`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            role="progressbar"
            aria-label="Focus mode progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            style={{ width: 140, height: 6, background: 'var(--input-bg)', borderRadius: 999, overflow: 'hidden' }}
          >
            <div style={{ height: '100%', width: `${progressPct}%`, background: '#10b981', borderRadius: 999, transition: 'width 0.3s ease' }} />
          </div>
          <button
            type="button"
            onClick={onExit}
            aria-keyshortcuts="Escape"
            style={{ background: 'var(--popover)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-normal)', fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}
          >
            Exit focus <span className="rc-kbd" style={{ marginLeft: 4 }}>Esc</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!current ? (
          <motion.div
            key="finished"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ border: '1px solid var(--daily-card-border)', borderRadius: 12, background: 'var(--daily-card-bg)', padding: '40px 24px', textAlign: 'center' }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>Deck finished</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 6 }}>
              You reviewed {done} {done === 1 ? 'problem' : 'problems'}. Press <span className="rc-kbd">U</span> to undo the last one.
            </div>
            <button
              type="button"
              onClick={onExit}
              style={{ marginTop: 16, background: 'var(--popover)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--foreground)', fontSize: 13, padding: '6px 14px', cursor: 'pointer' }}
            >
              Back to the list
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={current.id}
            ref={cardRef}
            tabIndex={-1}
            aria-label={`${current.title}. Press Space to reveal notes, 1, 2 or 3 to rate.`}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            style={{
              background: 'var(--daily-card-bg)',
              border: '1px solid var(--daily-card-border)',
              borderRadius: 14,
              padding: 'clamp(18px, 4vw, 32px)',
              boxShadow: 'var(--shadow-modal)',
              outline: 'none',
            }}
          >
            <CardHeader problem={current} />

            <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-strong)', lineHeight: 1.3, margin: '0 0 20px', overflowWrap: 'anywhere' }}>
              {current.title}
            </h2>

            <div style={{ marginBottom: 24 }}>
              {!revealed && <RecallQuestions key={current.id} problem={current} />}
              <RecallPrompt
                revealed={revealed}
                onReveal={() => setRevealedId(current.id)}
                hint={<span style={{ fontSize: 12, color: 'var(--text-dim)' }}>or press <span className="rc-kbd">Space</span></span>}
              />
              {revealed && <RecallDetails problem={current} />}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {CONFIDENCES.map((conf, i) => {
                const c = CARD_COLORS[conf];
                const next = describeInterval(nextIntervalLabel(current, conf, ladder));
                return (
                  <button
                    key={conf}
                    type="button"
                    onClick={() => onRate(current, conf)}
                    disabled={pendingConf !== null}
                    aria-keyshortcuts={String(i + 1)}
                    aria-label={`${c.label}${next ? `, ${next}` : ''}`}
                    style={{
                      background: c.bg,
                      border: `1px solid ${c.border}`,
                      borderRadius: 10,
                      padding: '12px 14px',
                      color: c.text,
                      cursor: pendingConf ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = c.bgHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = c.bg)}
                  >
                    <span style={{ fontSize: 15, fontWeight: 600 }}>
                      {i + 1}. {pendingConf === conf ? 'Saving…' : c.label}
                    </span>
                    <span style={{ fontSize: 11.5, opacity: 0.85 }}>{next ? next.charAt(0).toUpperCase() + next.slice(1) : ''}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 14, marginTop: 16, fontSize: 12, color: 'var(--text-dim)' }}>
              <button
                type="button"
                onClick={() => onSnooze(current, 1)}
                aria-keyshortcuts="S"
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Snooze to tomorrow
              </button>
              <span><span className="rc-kbd">S</span> snooze</span>
              <span><span className="rc-kbd">U</span> undo last</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function CardHeader({ problem }: { problem: any }) {
  const diffStyle = getDifficultyStyle(problem.difficulty);
  const topicColor = getTopicColor(problem.topic);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PlatformLogo platform={problem.platform ?? 'LEETCODE'} size={22} />
        {(problem.platform === 'LEETCODE' || problem.platform === 'CODEFORCES') && (problem.problemNumber ?? 0) > 0 && (
          <span style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 14, color: 'var(--text-dim)' }}>#{problem.problemNumber}</span>
        )}
        {problem.isRecheck && (
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)', border: '1px solid var(--input-border)', borderRadius: 4, padding: '1px 6px' }}>Recheck</span>
        )}
        {(problem.daysOverdue ?? 0) > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 600, color: '#f87171', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 4, padding: '1px 6px' }}>
            {problem.daysOverdue}d late
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Pill bg={diffStyle.bg} text={diffStyle.text} border={diffStyle.border}>
          {problem.difficulty.charAt(0) + problem.difficulty.slice(1).toLowerCase()}
        </Pill>
        <Pill bg={topicColor.bg} text={topicColor.text} border={topicColor.border}>
          {problem.topic}
        </Pill>
        {problem.url && (
          <a
            href={problem.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${problem.title} in a new tab`}
            style={{ color: 'var(--text-subtle)', display: 'inline-flex', padding: 4 }}
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
}
