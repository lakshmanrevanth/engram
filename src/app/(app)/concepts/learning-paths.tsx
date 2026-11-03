'use client';

// Learning paths: read each path top to bottom, one article at a time.
// Marking an article as learned turns it into a concept on the review ladder,
// and unlocks the next article in that path.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { format, isBefore, endOfDay } from 'date-fns';
import { Check, Lock, ArrowLeft, ExternalLink } from 'lucide-react';
import {
  LEARNING_PATHS,
  PATHS_SOURCE,
  pathCode,
  promptsFor,
  type LearningPath,
  type PathArticle,
} from '@/lib/concepts/paths';

export type TrackedForPaths = {
  id: string;
  code: string | null;
  dateSolved: string;
  status: 'ACTIVE' | 'MASTERED' | 'RETIRED';
  nextRevisionAt: string;
};

const STORAGE_KEY = 'recall_selected_path';

// The open path is remembered in this browser. useSyncExternalStore reads it without a
// hydration mismatch (the server render sees null).
const noopSubscribe = () => () => {};
function readStoredPath(): string | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && LEARNING_PATHS.some((p) => p.slug === saved) ? saved : null;
  } catch {
    return null;
  }
}

const card: React.CSSProperties = {
  border: '1px solid var(--daily-card-border)',
  borderRadius: 8,
  background: 'var(--daily-card-bg)',
};
const primaryButton: React.CSSProperties = {
  background: 'var(--foreground)',
  color: 'var(--background)',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  padding: '8px 14px',
  cursor: 'pointer',
};
const ghostButton: React.CSSProperties = {
  background: 'var(--popover)',
  color: 'var(--foreground)',
  border: '1px solid var(--input-border)',
  borderRadius: 6,
  fontSize: 13,
  padding: '7px 12px',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      style={{ height: 6, borderRadius: 3, background: 'var(--input-border)', overflow: 'hidden' }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: value === max && max > 0 ? 'var(--success)' : 'var(--foreground)',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

function reviewText(c: TrackedForPaths) {
  if (c.status === 'RETIRED') return 'Retired';
  const due = new Date(c.nextRevisionAt);
  if (isBefore(due, endOfDay(new Date()))) return 'Review due now';
  return `${c.status === 'MASTERED' ? 'Recheck' : 'Next review'} ${format(due, 'MMM d')}`;
}

export function LearningPaths({
  tracked,
  onLearned,
}: {
  tracked: TrackedForPaths[];
  onLearned: () => void;
}) {
  const byCode = useMemo(() => {
    const m = new Map<string, TrackedForPaths>();
    for (const c of tracked) if (c.code?.startsWith('path:')) m.set(c.code, c);
    return m;
  }, [tracked]);

  const learnedIn = (p: LearningPath) => p.articles.filter((a) => byCode.has(pathCode(a.id))).length;
  const totalArticles = LEARNING_PATHS.reduce((n, p) => n + p.articles.length, 0);
  const totalLearned = LEARNING_PATHS.reduce((n, p) => n + learnedIn(p), 0);

  const stored = useSyncExternalStore(noopSubscribe, readStoredPath, () => null);
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const selected = choice === undefined ? stored : choice;
  const open = (slug: string | null) => {
    setChoice(slug);
    try {
      if (slug) localStorage.setItem(STORAGE_KEY, slug);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
    window.scrollTo({ top: 0 });
  };

  const path = LEARNING_PATHS.find((p) => p.slug === selected);

  return (
    <section aria-label="Learning paths">
      {path ? (
        <PathDetail path={path} byCode={byCode} onBack={() => open(null)} onLearned={onLearned} />
      ) : (
        <>
          <div style={{ ...card, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>
              <span>
                You have learned <strong style={{ color: 'var(--foreground)' }}>{totalLearned}</strong> of {totalArticles} articles
              </span>
              <span>{totalArticles ? Math.round((totalLearned / totalArticles) * 100) : 0}%</span>
            </div>
            <ProgressBar value={totalLearned} max={totalArticles} label="Overall progress" />
          </div>

          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            {LEARNING_PATHS.map((p, i) => {
              const done = learnedIn(p);
              const status = done === 0 ? 'Not started' : done === p.articles.length ? 'Completed' : 'In progress';
              const next = p.articles.find((a) => !byCode.has(pathCode(a.id)));
              return (
                <li key={p.slug}>
                  <button
                    type="button"
                    onClick={() => open(p.slug)}
                    style={{ ...card, width: '100%', textAlign: 'left', padding: 16, cursor: 'pointer', display: 'flex', gap: 16, color: 'inherit' }}
                    aria-label={`${p.title}: ${done} of ${p.articles.length} learned. Open path.`}
                  >
                    <span style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 13, color: 'var(--text-muted)', minWidth: 22 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-strong)' }}>{p.title}</span>
                        <span
                          style={{
                            fontSize: 12,
                            color: status === 'Completed' ? 'var(--success)' : status === 'In progress' ? 'var(--foreground)' : 'var(--text-muted)',
                          }}
                        >
                          {status}
                        </span>
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>{p.description}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {p.articles.length} articles · {p.levelLabel} · {done}/{p.articles.length} learned
                        {next && done > 0 ? ` · Up next: ${next.title}` : ''}
                      </span>
                      <ProgressBar value={done} max={p.articles.length} label={`${p.title} progress`} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
        Paths and articles by {PATHS_SOURCE.author} on{' '}
        <a href={PATHS_SOURCE.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-dim)' }}>
          {PATHS_SOURCE.name}
        </a>
        . Articles open on the original site.
      </p>
    </section>
  );
}

function PathDetail({
  path,
  byCode,
  onBack,
  onLearned,
}: {
  path: LearningPath;
  byCode: Map<string, TrackedForPaths>;
  onBack: () => void;
  onLearned: () => void;
}) {
  const done = path.articles.filter((a) => byCode.has(pathCode(a.id))).length;
  const nextIndex = path.articles.findIndex((a) => !byCode.has(pathCode(a.id)));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  // The "Mark as learned" button disappears once an article is learned, so move focus
  // to the confirmation instead of losing it.
  const messageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) messageRef.current?.focus();
  }, [message]);

  const markLearned = async (article: PathArticle) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/concepts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathArticleId: article.id, notes }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not save');
      const due = new Date(json.nextRevisionAt);
      const following = path.articles[article.position];
      setMessage({
        kind: 'success',
        text: `Learned “${article.title}”. First review ${format(due, 'EEE, MMM d')}.${following ? ` Next up: ${following.title}.` : ' Path complete!'}`,
      });
      setNotes('');
      onLearned();
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={onBack} style={{ ...ghostButton, marginBottom: 14 }}>
        <ArrowLeft size={14} aria-hidden /> All paths
      </button>

      <div style={{ ...card, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
          {path.levelLabel} · {path.articles.length} articles
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px', color: 'var(--foreground)' }}>{path.title}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 12px', lineHeight: 1.5 }}>{path.description}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 6 }}>
          <span>
            {done} of {path.articles.length} learned
          </span>
          <span>{Math.round((done / path.articles.length) * 100)}%</span>
        </div>
        <ProgressBar value={done} max={path.articles.length} label={`${path.title} progress`} />
      </div>

      <div role="status" aria-live="polite" style={{ minHeight: message ? undefined : 0 }}>
        {message && (
          <div
            ref={messageRef}
            tabIndex={-1}
            style={{
              ...card,
              padding: '10px 14px',
              marginBottom: 12,
              fontSize: 13,
              color: message.kind === 'error' ? 'var(--error)' : 'var(--foreground)',
              borderColor: message.kind === 'error' ? 'var(--error-border)' : 'var(--daily-card-border)',
            }}
          >
            {message.text}
          </div>
        )}
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {path.articles.map((a, i) => {
          const learned = byCode.get(pathCode(a.id));
          const isNext = i === nextIndex;
          const locked = !learned && !isNext;
          return (
            <li
              key={a.id}
              aria-current={isNext ? 'step' : undefined}
              style={{
                ...card,
                padding: isNext ? 16 : '12px 16px',
                opacity: locked ? 0.6 : 1,
                borderColor: isNext ? 'var(--foreground)' : 'var(--daily-card-border)',
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontFamily: 'var(--font-geist-mono), monospace',
                    background: learned ? 'var(--success-bg)' : isNext ? 'var(--foreground)' : 'transparent',
                    color: learned ? 'var(--success)' : isNext ? 'var(--background)' : 'var(--text-muted)',
                    border: learned || isNext ? 'none' : '1px solid var(--input-border)',
                  }}
                >
                  {learned ? <Check size={13} /> : locked ? <Lock size={11} /> : a.position}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    {isNext && (
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)' }}>
                        Up next
                      </span>
                    )}
                    <span style={{ fontSize: 14, fontWeight: isNext ? 600 : 500, color: 'var(--text-strong)' }}>{a.title}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{a.kind === 'hld' ? 'HLD' : a.kind === 'lld' ? 'LLD' : 'Concept'}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 3, lineHeight: 1.5 }}>{a.summary}</div>

                  {learned && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>Learned {format(new Date(learned.dateSolved), 'MMM d')}</span>
                      <span>{reviewText(learned)}</span>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-dim)' }}>
                        Re-read ↗
                      </a>
                    </div>
                  )}

                  {locked && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Unlocks after “{path.articles[i - 1].title}”
                    </div>
                  )}

                  {isNext && (
                    <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text-normal)', lineHeight: 1.6 }}>
                        <div style={{ color: 'var(--text-dim)' }}>After reading, you&apos;ll be asked to recall:</div>
                        <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                          {promptsFor(a).map((q) => (
                            <li key={q}>{q}</li>
                          ))}
                        </ol>
                      </div>
                      <label htmlFor={`notes-${a.id}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>
                        Your notes (optional — what you took away, in your own words)
                      </label>
                      <textarea
                        id={`notes-${a.id}`}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--input-border)',
                          borderRadius: 6,
                          color: 'var(--foreground)',
                          fontSize: 13,
                          padding: '8px 10px',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <a href={a.url} target="_blank" rel="noopener noreferrer" style={ghostButton}>
                          Read article <ExternalLink size={13} aria-hidden />
                        </a>
                        <button
                          type="button"
                          onClick={() => markLearned(a)}
                          disabled={saving}
                          style={{ ...primaryButton, opacity: saving ? 0.6 : 1 }}
                        >
                          {saving ? 'Saving…' : 'Mark as learned'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {nextIndex === -1 && (
        <div style={{ ...card, padding: 16, marginTop: 12, fontSize: 13.5, color: 'var(--text-normal)' }}>
          🎉 You&apos;ve learned every article in this path. Keep up with the reviews in your Daily queue.
        </div>
      )}
    </div>
  );
}
