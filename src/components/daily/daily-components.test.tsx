import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ToastStack, type ToastItem } from './toast-stack';
import { ProblemRevisionRow } from './problem-row';
import { FocusDeck } from './focus-deck';
import { AllDone } from './all-done';
import { StatsStrip } from './stats-strip';

const problem = {
  id: 'p1',
  title: 'Two Sum',
  problemNumber: 1,
  platform: 'LEETCODE',
  difficulty: 'EASY',
  topic: 'Arrays',
  url: 'https://leetcode.com/problems/two-sum',
  status: 'ACTIVE',
  currentStep: 1,
  daysOverdue: 2,
  notes: 'Use a hash map of value → index.',
  revisionCount: 2,
};

describe('ToastStack', () => {
  it('renders one live region with every toast stacked', () => {
    const toasts: ToastItem[] = [
      { id: 't1', kind: 'error', message: 'Failed to submit revision' },
      { id: 't2', kind: 'undo', problemId: 'p1', revisionId: 'r1', title: 'Two Sum', confidence: 'CLEAN' },
      { id: 't3', kind: 'undo', problemId: 'p2', revisionId: 'r2', title: 'LRU Cache', confidence: 'STRUGGLED' },
    ];
    const markup = renderToStaticMarkup(<ToastStack toasts={toasts} onDismiss={vi.fn()} onUndo={vi.fn()} />);
    expect(markup.match(/aria-live="polite"/g)).toHaveLength(1);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Failed to submit revision');
    expect(markup).toContain('Undo rating for Two Sum');
    expect(markup).toContain('Undo rating for LRU Cache');
    expect(markup).toContain('Struggled');
  });

  it('keeps the region in the page when empty', () => {
    const markup = renderToStaticMarkup(<ToastStack toasts={[]} onDismiss={vi.fn()} onUndo={vi.fn()} />);
    expect(markup).toContain('aria-label="Notifications"');
  });
});

describe('ProblemRevisionRow', () => {
  it('labels rating buttons with the user ladder', () => {
    const markup = renderToStaticMarkup(
      <ProblemRevisionRow problem={problem} ladder={[2, 4, 8, 16]} onRate={vi.fn()} onSnooze={vi.fn()} onRetire={vi.fn()} />
    );
    expect(markup).toContain('Rate Two Sum as Clean, next review in 8d');
    expect(markup).toContain('Rate Two Sum as Shaky, next review in 4d');
    expect(markup).toContain('Rate Two Sum as Struggled, next review in 2d');
    expect(markup).toContain('2d late');
  });

  it('has an accessible more-actions menu button and a collapsed recall panel', () => {
    const markup = renderToStaticMarkup(
      <ProblemRevisionRow problem={problem} onRate={vi.fn()} onSnooze={vi.fn()} onRetire={vi.fn()} />
    );
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('More actions for Two Sum');
    expect(markup).toContain('aria-expanded="false"');
    // Notes stay hidden until the user recalls and reveals them.
    expect(markup).not.toContain('hash map');
  });

  it('shows a saving state while the rating is in flight', () => {
    const markup = renderToStaticMarkup(<ProblemRevisionRow problem={problem} pendingConf="SHAKY" onRate={vi.fn()} />);
    expect(markup).toContain('Saving…');
    expect(markup).toContain('disabled');
  });
});

describe('FocusDeck', () => {
  it('shows one card with recall prompt and ladder-based labels', () => {
    const markup = renderToStaticMarkup(
      <FocusDeck
        problems={[problem, { ...problem, id: 'p2', title: 'Valid Anagram' }]}
        ladder={[3, 7, 14, 30]}
        onRate={vi.fn()}
        onSnooze={vi.fn()}
        onUndo={vi.fn()}
        onExit={vi.fn()}
      />
    );
    expect(markup).toContain('Card 1 of 2');
    expect(markup).toContain('Two Sum');
    expect(markup).not.toContain('Valid Anagram');
    expect(markup).toContain('Try to recall your approach first');
    expect(markup).toContain('Back in 14 days');
    expect(markup).toContain('Back in 7 days');
    expect(markup).toContain('Back in 3 days');
    expect(markup).not.toContain('tomorrow</span>');
    expect(markup).not.toContain('hash map');
  });
});

describe('AllDone and StatsStrip copy', () => {
  it('says when the next review is due', () => {
    const markup = renderToStaticMarkup(<AllDone streak={3} upcoming={{ date: '2026-11-04', count: 4 }} todayKey="2026-11-03" />);
    expect(markup).toContain('Next: 4 problems tomorrow');
    expect(markup).not.toContain('Come back tomorrow');
  });

  it('explains a goal-based streak that is not met yet', () => {
    const markup = renderToStaticMarkup(
      <AllDone streak={3} upcoming={null} todayKey="2026-11-03" goalBasedStreak goalMet={false} />
    );
    expect(markup).toContain('daily goal');
  });

  it('shows the streak rule', () => {
    const markup = renderToStaticMarkup(
      <StatsStrip streak={2} totalProblems={5} masteredCount={1} dueCount={3} streakRule="a day counts when you review 5" />
    );
    expect(markup).toContain('a day counts when you review 5');
  });
});
