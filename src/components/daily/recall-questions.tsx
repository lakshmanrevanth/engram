'use client';

// Recall questions shown before the notes are revealed. They can be generated with
// AI from the item and the user's notes, regenerated, or edited by hand.

import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { Sparkles, Pencil } from 'lucide-react';

const smallButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '3px 9px',
  fontSize: 12,
  borderRadius: 6,
  background: 'var(--popover)',
  color: 'var(--foreground)',
  border: '1px solid var(--input-border)',
  cursor: 'pointer',
};

export function RecallQuestions({ problem }: { problem: { id: string; recallQuestions?: string[] | null } }) {
  const { mutate } = useSWRConfig();
  const [questions, setQuestions] = useState<string[]>(
    Array.isArray(problem.recallQuestions) ? problem.recallQuestions : []
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const refreshCaches = () =>
    mutate(
      (key: unknown) =>
        typeof key === 'string' && (key.startsWith('/api/daily') || key.startsWith('/api/problems') || key === '/api/concepts'),
      undefined,
      { revalidate: true }
    );

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/problems/${problem.id}/questions`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (res.status === 503 && json.code === 'AI_NOT_CONFIGURED') {
        setUnavailable(true);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? 'Could not generate questions');
      setQuestions(json.questions);
      refreshCaches();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate questions');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/problems/${problem.id}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: draft.split('\n') }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not save');
      setQuestions(json.questions);
      setEditing(false);
      refreshCaches();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div onClick={stop} onKeyDown={stop} style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-normal)' }}>
      {editing ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor={`rq-${problem.id}`} style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            One question per line (up to 5)
          </label>
          <textarea
            id={`rq-${problem.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 6,
              color: 'var(--foreground)',
              fontSize: 13,
              padding: '6px 8px',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={save} disabled={busy} style={{ ...smallButton, fontWeight: 600 }}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} style={smallButton}>
              Cancel
            </button>
          </div>
        </div>
      ) : questions.length > 0 ? (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Answer these from memory:</div>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {!unavailable && (
              <button type="button" onClick={generate} disabled={busy} style={smallButton} aria-label="Regenerate recall questions with AI">
                <Sparkles size={12} aria-hidden /> {busy ? 'Generating…' : 'Regenerate'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setDraft(questions.join('\n'));
                setEditing(true);
              }}
              style={smallButton}
              aria-label="Edit recall questions"
            >
              <Pencil size={12} aria-hidden /> Edit
            </button>
          </div>
        </>
      ) : unavailable ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          AI questions aren&apos;t set up on this server (add ANTHROPIC_API_KEY).{' '}
          <button
            type="button"
            onClick={() => {
              setDraft('');
              setEditing(true);
            }}
            style={{ ...smallButton, padding: '1px 6px' }}
          >
            Write your own
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={generate} disabled={busy} style={smallButton}>
            <Sparkles size={12} aria-hidden /> {busy ? 'Generating questions…' : 'Generate recall questions with AI'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft('');
              setEditing(true);
            }}
            style={smallButton}
          >
            <Pencil size={12} aria-hidden /> Write your own
          </button>
        </div>
      )}
      {error && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--error)', marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}
