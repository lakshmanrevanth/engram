'use client';

// System Design: log concepts as you learn them; they are reviewed on the same
// spaced repetition ladder as coding problems (in the Daily queue) and included
// in reminder emails.

import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { format, formatDistanceToNowStrict, isBefore, endOfDay } from 'date-fns';
import { fetcher } from '@/lib/fetcher';
import { LearningPaths } from './learning-paths';
import {
  CONCEPTS,
  CONCEPT_CATEGORIES,
  searchConcepts,
  type Concept,
  type ConceptLevel,
} from '@/lib/concepts/library';

type TrackedConcept = {
  id: string;
  title: string;
  topic: string;
  difficulty: ConceptLevel;
  notes: string | null;
  url: string;
  code: string | null;
  dateSolved: string;
  status: 'ACTIVE' | 'MASTERED' | 'RETIRED';
  currentStep: number;
  nextRevisionAt: string;
  revisionCount: number;
  revisions: { confidence: 'CLEAN' | 'SHAKY' | 'STRUGGLED'; revisedAt: string }[];
};

const LEVEL_LABEL: Record<ConceptLevel, string> = { EASY: 'Basics', MEDIUM: 'Core', HARD: 'Advanced' };

const card: React.CSSProperties = {
  border: '1px solid var(--daily-card-border)',
  borderRadius: 8,
  background: 'var(--daily-card-bg)',
  padding: 16,
};
const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 };
const input: React.CSSProperties = {
  width: '100%',
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  borderRadius: 6,
  color: 'var(--foreground)',
  fontSize: 13.5,
  padding: '8px 10px',
  boxSizing: 'border-box',
};
const button: React.CSSProperties = {
  background: 'var(--foreground)',
  color: 'var(--background)',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
};
const ghostButton: React.CSSProperties = {
  background: 'var(--popover)',
  color: 'var(--foreground)',
  border: '1px solid var(--input-border)',
  borderRadius: 6,
  fontSize: 12.5,
  padding: '5px 10px',
  cursor: 'pointer',
};

const noopSubscribe = () => () => {};

function localDateKey(d = new Date()) {
  return format(d, 'yyyy-MM-dd');
}

function ladderDots(step: number, status: TrackedConcept['status']) {
  return (
    <span aria-label={status === 'MASTERED' ? 'Mastered' : `Step ${step + 1} of 4`} style={{ display: 'inline-flex', gap: 3 }}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: status === 'MASTERED' || i <= step ? 'var(--foreground)' : 'var(--input-border)',
            opacity: status === 'MASTERED' || i <= step ? 0.85 : 1,
          }}
        />
      ))}
    </span>
  );
}

function nextReviewText(c: TrackedConcept) {
  if (c.status === 'RETIRED') return 'Retired';
  const due = new Date(c.nextRevisionAt);
  if (isBefore(due, endOfDay(new Date()))) return c.status === 'MASTERED' ? 'Recheck due now' : 'Due now';
  const prefix = c.status === 'MASTERED' ? 'Recheck' : 'Next review';
  return `${prefix} ${format(due, 'MMM d')} (in ${formatDistanceToNowStrict(due, { unit: 'day', roundingMethod: 'ceil' })})`;
}

export default function ConceptsPage() {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading, mutate: reload } = useSWR<TrackedConcept[]>('/api/concepts', fetcher);
  // SWR's cache lives in localStorage, so the browser's first render already has data the
  // server didn't. Use it only after hydration to avoid a mismatch.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const tracked = useMemo(() => (hydrated && Array.isArray(data) ? data : []), [hydrated, data]);
  const trackedSlugs = useMemo(() => new Set(tracked.map((c) => c.code).filter(Boolean)), [tracked]);

  // Form state
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Concept | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [category, setCategory] = useState<string>('Fundamentals');
  const [level, setLevel] = useState<ConceptLevel>('MEDIUM');
  const [learnedOn, setLearnedOn] = useState(localDateKey());
  const [notes, setNotes] = useState('');
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<string>('All');
  const [view, setView] = useState<'paths' | 'concepts'>('paths');
  const titleRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => searchConcepts(query, 8), [query]);

  const pick = (c: Concept) => {
    setPicked(c);
    setQuery(c.title);
    setCategory(c.category);
    setLevel(c.level);
    setShowSuggestions(false);
  };

  const resetForm = () => {
    setPicked(null);
    setQuery('');
    setNotes('');
    setLink('');
    setLearnedOn(localDateKey());
  };

  const save = async (override?: { slug: string }) => {
    setMessage(null);
    const body = override
      ? { slug: override.slug, learnedOn: localDateKey() }
      : picked && picked.title === query.trim()
        ? { slug: picked.slug, notes, learnedOn, url: link, level }
        : { title: query.trim(), category, level, notes, learnedOn, url: link };
    if (!override && !query.trim()) {
      setMessage({ kind: 'error', text: 'Type the concept you learned, or pick one from the library.' });
      titleRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/concepts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not save');
      const due = new Date(json.nextRevisionAt);
      setMessage({
        kind: 'success',
        text: `Saved “${json.title}”. First review ${isBefore(due, endOfDay(new Date())) ? 'is due today' : `on ${format(due, 'EEE, MMM d')}`}.`,
      });
      if (!override) resetForm();
      reload();
      mutate('/api/problems');
      mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/daily'));
      mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/problems/due'));
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  const todayKey = localDateKey();
  const learnedToday = tracked.filter((c) => localDateKey(new Date(c.dateSolved)) === todayKey);
  const dueNow = tracked.filter(
    (c) => c.status !== 'RETIRED' && isBefore(new Date(c.nextRevisionAt), endOfDay(new Date()))
  );
  const mastered = tracked.filter((c) => c.status === 'MASTERED').length;
  const upcoming = tracked
    .filter((c) => c.status !== 'RETIRED' && !dueNow.includes(c))
    .sort((a, b) => +new Date(a.nextRevisionAt) - +new Date(b.nextRevisionAt));

  const libraryList = CONCEPTS.filter((c) => libraryFilter === 'All' || c.category === libraryFilter);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 48 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>System Design</h1>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{format(new Date(), 'EEEE, MMMM d')}</span>
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--text-dim)', margin: '0 0 20px', lineHeight: 1.6 }}>
        Log what you learned today. Each concept comes back for review after 3, 7, 14 and 30 days in your{' '}
        <Link href="/daily" style={{ color: 'var(--foreground)' }}>Daily queue</Link> (using your intervals from Settings), then once more
        after 90 days. Reminder emails include concepts that are due.
      </p>

      {/* Stats */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>
        <span><strong style={{ color: 'var(--foreground)' }}>{tracked.length}</strong> concepts tracked</span>
        <span><strong style={{ color: 'var(--foreground)' }}>{learnedToday.length}</strong> learned today</span>
        <span><strong style={{ color: 'var(--foreground)' }}>{dueNow.length}</strong> due for review</span>
        <span><strong style={{ color: 'var(--foreground)' }}>{mastered}</strong> mastered</span>
      </div>

      {/* Views */}
      <div role="tablist" aria-label="System design views" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--table-border)', marginBottom: 20 }}>
        {([
          ['paths', 'Learning paths'],
          ['concepts', 'My concepts & library'],
        ] as const).map(([key, text]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: view === key ? '2px solid var(--foreground)' : '2px solid transparent',
              color: view === key ? 'var(--foreground)' : 'var(--text-dim)',
              fontSize: 13.5,
              fontWeight: view === key ? 600 : 400,
              padding: '8px 12px',
              marginBottom: -1,
              cursor: 'pointer',
            }}
          >
            {text}
          </button>
        ))}
      </div>

      {view === 'paths' && <LearningPaths tracked={tracked} onLearned={() => {
        reload();
        mutate('/api/problems');
        mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/daily'));
      }} />}

      {view === 'concepts' && (
      <>
      {/* Log form */}
      <section aria-labelledby="log-heading" style={{ ...card, marginBottom: 24 }}>
        <h2 id="log-heading" style={{ fontSize: 15, fontWeight: 600, margin: '0 0 14px', color: 'var(--foreground)' }}>
          What did you learn?
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          style={{ display: 'grid', gap: 14 }}
        >
          <div style={{ position: 'relative' }}>
            <label htmlFor="concept-title" style={label}>Concept</label>
            <input
              id="concept-title"
              ref={titleRef}
              value={query}
              autoComplete="off"
              placeholder="e.g. Consistent hashing, CAP theorem, Design a chat system…"
              role="combobox"
              aria-expanded={showSuggestions && suggestions.length > 0}
              aria-controls="concept-suggestions"
              aria-autocomplete="list"
              onChange={(e) => {
                setQuery(e.target.value);
                if (picked && e.target.value !== picked.title) setPicked(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShowSuggestions(false);
              }}
              style={input}
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul
                id="concept-suggestions"
                role="listbox"
                style={{
                  position: 'absolute',
                  zIndex: 20,
                  top: '100%',
                  left: 0,
                  right: 0,
                  margin: '4px 0 0',
                  padding: 4,
                  listStyle: 'none',
                  background: 'var(--popover)',
                  border: '1px solid var(--input-border)',
                  borderRadius: 6,
                  boxShadow: 'var(--shadow-popover)',
                  maxHeight: 280,
                  overflowY: 'auto',
                }}
              >
                {suggestions.map((c) => (
                  <li key={c.slug} role="option" aria-selected={picked?.slug === c.slug}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(c)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--foreground)',
                        padding: '7px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 13,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span>
                        {c.title}
                        {trackedSlugs.has(c.slug) && <span style={{ color: 'var(--text-muted)' }}> · tracked</span>}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>{c.category}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {picked && (
            <div style={{ fontSize: 13, color: 'var(--text-normal)', lineHeight: 1.6, borderLeft: '2px solid var(--input-border)', paddingLeft: 12 }}>
              <div>{picked.summary}</div>
              <div style={{ marginTop: 6, color: 'var(--text-dim)' }}>You&apos;ll be asked to recall:</div>
              <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {picked.prompts.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div>
              <label htmlFor="concept-category" style={label}>Category</label>
              <select
                id="concept-category"
                value={category}
                disabled={!!picked}
                onChange={(e) => setCategory(e.target.value)}
                style={input}
              >
                {CONCEPT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="concept-level" style={label}>Level</label>
              <select id="concept-level" value={level} onChange={(e) => setLevel(e.target.value as ConceptLevel)} style={input}>
                {(['EASY', 'MEDIUM', 'HARD'] as ConceptLevel[]).map((l) => (
                  <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="concept-date" style={label}>Learned on</label>
              <input
                id="concept-date"
                type="date"
                value={learnedOn}
                max={todayKey}
                onChange={(e) => setLearnedOn(e.target.value)}
                style={input}
              />
            </div>
          </div>

          <div>
            <label htmlFor="concept-notes" style={label}>Your notes (key ideas, trade-offs, a diagram in words)</label>
            <textarea
              id="concept-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Write it in your own words — this is what you'll reveal when it's time to review."
              style={{ ...input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
          </div>

          <div>
            <label htmlFor="concept-link" style={label}>Source link (optional)</label>
            <input
              id="concept-link"
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://… (article, video or book chapter)"
              style={input}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button type="submit" disabled={saving} style={{ ...button, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save and schedule reviews'}
            </button>
            <div role="status" aria-live="polite" style={{ fontSize: 13, color: message?.kind === 'error' ? 'var(--error)' : 'var(--text-normal)' }}>
              {message?.text}
            </div>
          </div>
        </form>
      </section>

      {/* Tracked concepts */}
      <section aria-labelledby="tracked-heading" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <h2 id="tracked-heading" style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>Your concepts</h2>
          {dueNow.length > 0 && (
            <Link href="/daily" style={{ ...ghostButton, textDecoration: 'none' }}>
              Review {dueNow.length} due now →
            </Link>
          )}
        </div>

        {error && !data ? (
          <div role="alert" style={{ ...card, fontSize: 13.5 }}>
            Couldn&apos;t load your concepts.{' '}
            <button type="button" onClick={() => reload()} style={ghostButton}>Try again</button>
          </div>
        ) : isLoading && !data ? (
          <div style={{ ...card, color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
        ) : tracked.length === 0 ? (
          <div style={{ ...card, color: 'var(--text-dim)', fontSize: 13.5, lineHeight: 1.6 }}>
            Nothing logged yet. Add the first concept you learned today above, or pick one from the library below.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {[...dueNow, ...upcoming, ...tracked.filter((c) => c.status === 'RETIRED')].map((c) => (
              <li key={c.id}>
                <details style={card}>
                  <summary
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', listStyle: 'none' }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-strong)', flex: '1 1 220px' }}>{c.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.topic} · {LEVEL_LABEL[c.difficulty]}</span>
                    {ladderDots(c.currentStep, c.status)}
                    <span
                      style={{
                        fontSize: 12,
                        color: dueNow.includes(c) ? 'var(--error)' : 'var(--text-dim)',
                        minWidth: 160,
                        textAlign: 'right',
                      }}
                    >
                      {nextReviewText(c)}
                    </span>
                  </summary>
                  <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-normal)', lineHeight: 1.6 }}>
                    <div style={{ color: 'var(--text-dim)', marginBottom: 8 }}>
                      Learned {format(new Date(c.dateSolved), 'MMM d, yyyy')} · reviewed {c.revisionCount}{' '}
                      {c.revisionCount === 1 ? 'time' : 'times'}
                      {c.revisions[0] && ` · last: ${c.revisions[0].confidence.toLowerCase()}`}
                    </div>
                    {c.notes ? (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{c.notes}</div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)' }}>No notes.</div>
                    )}
                    {c.url && (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, color: 'var(--foreground)' }}>
                        Open source ↗
                      </a>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Library */}
      <section aria-labelledby="library-heading">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <h2 id="library-heading" style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>
            Concept library <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 13 }}>({CONCEPTS.length})</span>
          </h2>
          <label style={{ fontSize: 12.5, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
            Category
            <select value={libraryFilter} onChange={(e) => setLibraryFilter(e.target.value)} style={{ ...input, width: 'auto', padding: '5px 8px' }}>
              <option value="All">All</option>
              {CONCEPT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {libraryList.map((c) => {
            const isTracked = trackedSlugs.has(c.slug);
            return (
              <li key={c.slug} style={{ ...card, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-strong)' }}>{c.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.category} · {LEVEL_LABEL[c.level]}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5, flex: 1 }}>{c.summary}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {isTracked ? (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>✓ Tracked</span>
                  ) : (
                    <>
                      <button type="button" disabled={saving} onClick={() => save({ slug: c.slug })} style={ghostButton} aria-label={`I learned ${c.title} today`}>
                        Learned today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          pick(c);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          setTimeout(() => document.getElementById('concept-notes')?.focus(), 300);
                        }}
                        style={{ ...ghostButton, background: 'transparent' }}
                        aria-label={`Add notes for ${c.title}`}
                      >
                        Add with notes
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      </>
      )}
    </div>
  );
}
