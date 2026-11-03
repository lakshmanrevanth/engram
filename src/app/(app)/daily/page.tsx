'use client';

import useSWR, { useSWRConfig } from 'swr';
import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Keyboard, Layers } from 'lucide-react';
import { StatsStrip } from '@/components/daily/stats-strip';
import { NotionTableHeader } from '@/components/daily/table-header';
import { ProblemRevisionRow } from '@/components/daily/problem-row';
import { AllDone } from '@/components/daily/all-done';
import { EmptyState } from '@/components/daily/empty-state';
import { ContributionHeatmap } from '@/components/heatmap';
import { CompletedSection } from '@/components/daily/completed-section';
import { ToastStack, useToastStack } from '@/components/daily/toast-stack';
import { FocusDeck } from '@/components/daily/focus-deck';
import { ShortcutsHelp } from '@/components/daily/shortcuts-help';
import { DailyStyles } from '@/components/daily/daily-styles';
import { isPlainShortcut, isTypingTarget, isUndoChord, RATING_KEYS } from '@/components/daily/keyboard';
import { applyDailyRating, applyDailyUndo, removeFromDue, type DailySummary } from '@/components/daily/summary-state';
import { fetcher } from '@/lib/fetcher';

type Confidence = 'CLEAN' | 'SHAKY' | 'STRUGGLED';

const BATCH_SIZE = 20;

const SNOOZE_LABEL: Record<number, string> = { 1: 'to tomorrow', 2: 'for 2 days', 3: 'for 3 days', 7: 'for a week' };

// Daily goal saved by older versions of Settings in this browser; the server value wins.
function readLocalGoal(): number | null {
  try {
    const n = Number(localStorage.getItem('recall_daily_target'));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

const otherDailyKeys = (key: unknown) =>
  typeof key === 'string' &&
  (key.startsWith('/api/problems/due') || key.startsWith('/api/problems/revised-today') || key === '/api/streak' || key === '/api/problems');

export default function DailyRevisionPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const [mounted, setMounted] = useState(false);
  const [localGoal, setLocalGoal] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    setLocalGoal(readLocalGoal());
  }, []);

  // Re-render when the tab comes back into view on a new day, so a tab left open
  // overnight doesn't keep showing yesterday's queue.
  const [dayKey, setDayKey] = useState(() => new Date().toDateString());
  useEffect(() => {
    const check = () => {
      const k = new Date().toDateString();
      setDayKey((prev) => (prev === k ? prev : k));
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(check, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, []);

  // One request for the queue, today's ratings, streak, counts and ladder. dayKey refetches at midnight.
  const summaryUrl = mounted ? `/api/daily/summary?d=${encodeURIComponent(dayKey)}` : null;
  const { data: summary, error: summaryError, mutate: mutateSummary } = useSWR<DailySummary>(summaryUrl, fetcher);
  const { data: activity, mutate: mutateActivity } = useSWR('/api/activity', fetcher);

  const toastStack = useToastStack();
  const { push: pushToast, dismissUndoFor } = toastStack;
  const [pending, setPending] = useState<Record<string, Confidence>>({});
  const [showAll, setShowAll] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const focusButtonRef = useRef<HTMLButtonElement>(null);
  // Due rows as they were before rating, so an undo can put them back right away.
  const snapshots = useRef(new Map<string, any>());

  const showToast = useCallback(
    (message: string, kind: 'success' | 'error' = 'error') => pushToast({ kind, message }),
    [pushToast]
  );

  const patchSummary = useCallback(
    (fn: (s: DailySummary) => DailySummary) =>
      mutateSummary((cur) => (cur ? fn(cur) : cur), { revalidate: false }),
    [mutateSummary]
  );

  const revalidateAll = useCallback(() => {
    mutateSummary();
    mutateActivity();
    globalMutate(otherDailyKeys);
  }, [mutateSummary, mutateActivity, globalMutate]);

  // ---------------------------------------------------------------------------
  // Derived lists
  // ---------------------------------------------------------------------------
  const due: any[] = Array.isArray(summary?.due) ? summary!.due : [];
  const completedList: any[] = Array.isArray(summary?.revisedToday) ? summary!.revisedToday : [];
  const ladder = summary?.ladder;
  const streakData = summary?.streak;
  const dailyGoal = streakData?.dailyGoal ?? localGoal ?? 5;
  const goalBasedStreak = !!streakData?.goalBasedStreak;

  const overdue = due.filter((p) => p.isOverdue);
  const dueToday = due.filter((p) => !p.isOverdue);
  const ordered = [...overdue, ...dueToday];
  const visible = showAll ? ordered : ordered.slice(0, BATCH_SIZE);
  const hiddenCount = ordered.length - visible.length;
  const visibleIds = new Set(visible.map((p) => p.id));
  const visibleOverdue = overdue.filter((p) => visibleIds.has(p.id));
  const visibleDueToday = dueToday.filter((p) => visibleIds.has(p.id));
  const rovingId = focusedId && visibleIds.has(focusedId) ? focusedId : visible[0]?.id ?? null;

  const focusRow = useCallback((id: string | null | undefined) => {
    if (!id) return;
    setFocusedId(id);
    const el = document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`);
    el?.focus();
    el?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  // When a row leaves the list, keep keyboard focus in the table on the next row.
  const keepFocusAfterRemoving = (id: string) => {
    const row = document.querySelector(`[data-row-id="${CSS.escape(id)}"]`);
    if (!row || !row.contains(document.activeElement)) return;
    const i = visible.findIndex((p) => p.id === id);
    const next = visible[i + 1] ?? visible[i - 1];
    if (next) requestAnimationFrame(() => focusRow(next.id));
  };

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const rate = async (problem: any, conf: Confidence) => {
    if (pending[problem.id]) return;
    setPending((p) => ({ ...p, [problem.id]: conf }));
    snapshots.current.set(problem.id, problem);
    keepFocusAfterRemoving(problem.id);
    // Optimistic: the row moves to "Completed today" at once.
    patchSummary((s) => applyDailyRating(s, problem, conf));
    try {
      const res = await fetch(`/api/problems/${problem.id}/revise`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confidence: conf }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Failed to submit revision');
      patchSummary((s) => applyDailyRating(s, problem, conf, j));
      pushToast({ kind: 'undo', problemId: problem.id, revisionId: j.revisionId ?? null, title: problem.title, confidence: conf });
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to submit revision');
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[problem.id];
        return next;
      });
      revalidateAll();
    }
  };

  const undo = async (problemId: string, revisionId?: string | null) => {
    dismissUndoFor(problemId);
    const item = completedList.find((p) => p.id === problemId);
    const rid = revisionId ?? item?.latestRevision?.id ?? null;
    patchSummary((s) => applyDailyUndo(s, problemId, snapshots.current.get(problemId)));
    try {
      const res = await fetch(`/api/problems/${problemId}/undo-revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rid ? { revisionId: rid } : {}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to undo revision');
      }
      snapshots.current.delete(problemId);
      showToast(item?.title ? `Undid the rating for “${item.title}”` : 'Rating undone', 'success');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to undo revision');
    } finally {
      revalidateAll();
    }
  };

  const undoLatest = () => {
    const t = toastStack.latestUndo;
    if (t) return undo(t.problemId, t.revisionId);
    const item = completedList.find((p) => !pending[p.id]);
    if (item) return undo(item.id, item.latestRevision?.id);
    showToast('Nothing to undo today', 'success');
  };

  const changeConfidence = async (problemId: string, newConf: Confidence) => {
    patchSummary((s) => ({
      ...s,
      revisedToday: s.revisedToday.map((p: any) =>
        p.id === problemId ? { ...p, latestRevision: { ...(p.latestRevision ?? {}), confidence: newConf } } : p
      ),
    }));
    try {
      const res = await fetch(`/api/problems/${problemId}/revise`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confidence: newConf, replaceLatest: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to update revision');
      }
      showToast(`Changed to ${newConf.charAt(0) + newConf.slice(1).toLowerCase()}`, 'success');
      revalidateAll();
    } catch (e: any) {
      mutateSummary();
      showToast(e?.message ?? 'Failed to update status');
      throw e;
    }
  };

  const snooze = async (problem: any, days: number) => {
    keepFocusAfterRemoving(problem.id);
    patchSummary((s) => removeFromDue(s, problem.id));
    try {
      const res = await fetch(`/api/problems/${problem.id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to snooze');
      }
      showToast(`Snoozed “${problem.title}” ${SNOOZE_LABEL[days] ?? `for ${days} days`}`, 'success');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to snooze');
    } finally {
      revalidateAll();
    }
  };

  const retire = async (problem: any) => {
    keepFocusAfterRemoving(problem.id);
    patchSummary((s) => removeFromDue(s, problem.id));
    try {
      const res = await fetch(`/api/problems/${problem.id}/retire`, { method: 'PATCH' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to retire');
      }
      showToast(`Retired “${problem.title}”. Set it back to Active from the problems table.`, 'success');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to retire');
    } finally {
      revalidateAll();
    }
  };

  const exitFocus = useCallback(() => {
    setFocusMode(false);
    requestAnimationFrame(() => focusButtonRef.current?.focus());
  }, []);

  // ---------------------------------------------------------------------------
  // Keyboard: j/k move, 1/2/3 rate the focused row, u / Ctrl+Z undo, ? help, f focus mode.
  // Focus mode handles its own keys (except Ctrl+Z).
  // ---------------------------------------------------------------------------
  const keyState = useRef({ visible, rovingId, focusedId, focusMode, rate, undoLatest, focusRow, hasDue: ordered.length > 0 });
  useEffect(() => {
    keyState.current = { visible, rovingId, focusedId, focusMode, rate, undoLatest, focusRow, hasDue: ordered.length > 0 };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = keyState.current;
      if (isUndoChord(e)) {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        s.undoLatest();
        return;
      }
      if (s.focusMode || !isPlainShortcut(e) || e.repeat) return;
      if ((e.target as HTMLElement)?.closest?.('[role="menu"], [role="dialog"]')) return;

      const ids = s.visible.map((p) => p.id);
      const idx = s.focusedId ? ids.indexOf(s.focusedId) : -1;
      if (e.key === 'j' || e.key === 'k') {
        if (ids.length === 0) return;
        e.preventDefault();
        const next = idx === -1 ? 0 : e.key === 'j' ? Math.min(idx + 1, ids.length - 1) : Math.max(idx - 1, 0);
        s.focusRow(ids[next]);
      } else if (RATING_KEYS[e.key]) {
        // Only when a row (or something inside it) has focus.
        const rowEl = (e.target as HTMLElement)?.closest?.('[data-row-id]');
        const id = rowEl?.getAttribute('data-row-id');
        const problem = id ? s.visible.find((p) => p.id === id) : null;
        if (!problem) return;
        e.preventDefault();
        s.rate(problem, RATING_KEYS[e.key]);
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        s.undoLatest();
      } else if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if ((e.key === 'f' || e.key === 'F') && s.hasDue) {
        e.preventDefault();
        setFocusMode(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const isDailyLoading = !mounted || (!summary && !summaryError);
  const isNewUser = summary?.counts?.total === 0;
  const streak = streakData?.currentStreak ?? 0;
  const reviewedToday = Math.max(streakData?.todayReviewed ?? 0, completedList.length);
  const goalMet = reviewedToday >= dailyGoal;
  const hasFinishedAll = due.length === 0 && completedList.length > 0;
  const todayKey = summary?.today ?? format(new Date(), 'yyyy-MM-dd');
  const streakRule = goalBasedStreak
    ? `a day counts when you review ${dailyGoal}`
    : 'a day counts when you review at least 1';

  const renderRow = (p: any) => (
    <ProblemRevisionRow
      key={p.id}
      problem={p}
      ladder={ladder}
      pendingConf={pending[p.id] ?? null}
      focused={rovingId === p.id}
      onRate={rate}
      onSnooze={snooze}
      onRetire={retire}
      onFocusRow={setFocusedId}
    />
  );

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto', paddingBottom: 48 }}>
      <DailyStyles />

      <div data-daily-header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>
          Daily Revision
        </h1>
        <span suppressHydrationWarning style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 13, color: 'var(--text-muted)' }}>
          {format(new Date(), 'EEEE, MMMM d')}
        </span>
      </div>

      <StatsStrip
        streak={streak}
        totalProblems={summary?.counts?.total ?? 0}
        masteredCount={summary?.counts?.mastered ?? 0}
        dueCount={due.length}
        overdueCount={overdue.length}
        todayCompleted={!!streakData?.todayCompleted}
        streakRule={summary ? streakRule : undefined}
      />

      {/* Goal progress + focus mode / shortcuts */}
      {mounted && summary && !isNewUser && (
        <div className="rc-daily-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '4px 0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
            <div
              role="progressbar"
              aria-label="Daily goal"
              aria-valuemin={0}
              aria-valuemax={dailyGoal}
              aria-valuenow={Math.min(reviewedToday, dailyGoal)}
              style={{ flex: '0 0 160px', height: 6, borderRadius: 3, background: 'var(--input-bg)', overflow: 'hidden' }}
            >
              <div
                style={{
                  width: `${Math.min(100, (reviewedToday / dailyGoal) * 100)}%`,
                  height: '100%',
                  background: goalMet ? '#10b981' : 'var(--foreground)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span>
              {reviewedToday} / {dailyGoal} reviewed today{goalMet ? ' · goal met' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            {ordered.length > 0 && !focusMode && (
              <button
                ref={focusButtonRef}
                type="button"
                onClick={() => setFocusMode(true)}
                aria-keyshortcuts="F"
                title="One card at a time (F)"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', fontSize: 12.5, fontWeight: 500,
                  borderRadius: 6, background: 'var(--popover)', color: 'var(--foreground)', border: '1px solid var(--input-border)', cursor: 'pointer',
                }}
              >
                <Layers size={13} /> Focus mode
              </button>
            )}
            <button
              type="button"
              data-shortcuts-toggle
              onClick={() => setHelpOpen((v) => !v)}
              aria-expanded={helpOpen}
              aria-controls={helpOpen ? 'daily-shortcuts' : undefined}
              aria-label="Keyboard shortcuts"
              aria-keyshortcuts="Shift+?"
              title="Keyboard shortcuts (?)"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 28,
                borderRadius: 6, background: helpOpen ? 'var(--accent)' : 'var(--popover)', color: 'var(--text-normal)', border: '1px solid var(--input-border)', cursor: 'pointer',
              }}
            >
              <Keyboard size={14} />
            </button>
            {helpOpen && <ShortcutsHelp id="daily-shortcuts" onClose={() => setHelpOpen(false)} />}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {isDailyLoading ? (
          <div style={{ border: '1px solid var(--daily-card-border)', borderRadius: 8, background: 'var(--daily-card-bg)', overflow: 'hidden' }}>
            <NotionTableHeader />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: 48, borderBottom: '1px solid var(--table-border)', background: 'var(--daily-row-skeleton)', opacity: 0.5 }} />
              ))}
            </div>
          </div>
        ) : summaryError && !summary ? (
          <motion.div
            key="error"
            role="alert"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ border: '1px solid var(--error-border)', borderRadius: 8, padding: '32px 16px', textAlign: 'center', color: 'var(--text-normal)', fontSize: 14 }}
          >
            Couldn&apos;t load today&apos;s reviews. Your progress is safe.
            <div>
              <button
                onClick={() => mutateSummary()}
                style={{ marginTop: 12, background: 'var(--popover)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--foreground)', fontSize: 13, padding: '6px 14px', cursor: 'pointer' }}
              >
                Try again
              </button>
            </div>
          </motion.div>
        ) : focusMode ? (
          <motion.div key="focus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FocusDeck
              problems={ordered}
              ladder={ladder}
              pendingConf={ordered[0] ? pending[ordered[0].id] ?? null : null}
              onRate={rate}
              onSnooze={(p, days) => snooze(p, days)}
              onUndo={undoLatest}
              onExit={exitFocus}
            />
          </motion.div>
        ) : due.length === 0 && completedList.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EmptyState isNewUser={isNewUser} upcoming={summary?.upcoming} todayKey={todayKey} ladder={ladder} />
          </motion.div>
        ) : hasFinishedAll ? (
          <AllDone
            key="done"
            streak={streak}
            upcoming={summary?.upcoming}
            todayKey={todayKey}
            goalMet={goalMet}
            goalBasedStreak={goalBasedStreak}
          />
        ) : (
          <motion.div
            data-daily-queue
            key="table-view"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              border: '1px solid var(--daily-card-border)',
              borderRadius: 8,
              background: 'var(--daily-card-bg)',
              // Visible so row menus aren't clipped.
              overflow: 'visible',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
          >
            <NotionTableHeader />

            {visibleOverdue.length > 0 && (
              <div>
                <div
                  style={{
                    padding: '7px 16px',
                    background: 'var(--daily-header-bg)',
                    borderBottom: '1px solid var(--table-border)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-normal)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#f87171', opacity: 0.8 }} />
                  Overdue ({overdue.length})
                </div>
                {visibleOverdue.map(renderRow)}
              </div>
            )}

            {visibleDueToday.length > 0 && (
              <div>
                {visibleOverdue.length > 0 && (
                  <div
                    style={{
                      padding: '8px 16px',
                      background: 'var(--daily-section-bg)',
                      borderBottom: '1px solid var(--table-border)',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-dim)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Due Today ({dueToday.length})
                  </div>
                )}
                {visibleDueToday.map(renderRow)}
              </div>
            )}

            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAll(true)}
                style={{ width: '100%', padding: '10px 16px', background: 'var(--daily-section-bg)', border: 'none', borderRadius: '0 0 8px 8px', color: 'var(--text-dim)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
              >
                Showing the {BATCH_SIZE} weakest first · Show {hiddenCount} more
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {mounted && !focusMode && (
        <CompletedSection
          problems={completedList}
          onUndo={(id) => undo(id)}
          onChangeConfidence={changeConfidence}
        />
      )}

      {mounted && (
        <ToastStack
          toasts={toastStack.toasts}
          onDismiss={toastStack.dismiss}
          onUndo={(t) => undo(t.problemId, t.revisionId)}
        />
      )}

      <div style={{ marginTop: 40 }}>
        <ContributionHeatmap activity={Array.isArray(activity) ? activity : []} />
      </div>
    </div>
  );
}
