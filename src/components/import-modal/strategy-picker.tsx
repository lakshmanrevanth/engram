'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { MASTERY_RECHECK_DAYS } from '@/lib/scheduling';
import type { ImportStrategy } from '@/lib/import-utils';

type StrategyPickerStepProps = {
  strategy: ImportStrategy;
  onStrategyChange: (s: ImportStrategy) => void;
  dailyPace: number;
  onDailyPaceChange: (pace: number) => void;
  totalProblems: number;
  onContinue: () => void;
  onBack: () => void;
  /** File carries status/step/next revision (backup or Engram CSV) — offers "Keep schedule". */
  hasSchedule?: boolean;
  /** First interval of the user's ladder, in days. */
  firstIntervalDays?: number;
  isBusy?: boolean;
};

const mono = 'var(--font-geist-mono), monospace';

function PaceSelector({ safePace, onChange, label }: { safePace: number; onChange: (n: number) => void; label: string }) {
  return (
    <div
      className="strategy-pace-box"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      style={{
        marginTop: 10,
        padding: '8px 12px',
        background: 'var(--import-counter-bg)',
        border: '1px solid var(--import-counter-border)',
        borderRadius: 4,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <div className="strategy-pace-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}:</span>
        <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--text-white)' }}>{safePace} problems/day</span>
      </div>

      <div className="strategy-pace-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="strategy-pace-presets" role="group" aria-label={`${label} presets`} style={{ display: 'flex', gap: 4 }}>
          {[2, 3, 5, 10, 15].map((preset) => (
            <button
              key={preset}
              className="strategy-pace-preset-btn"
              type="button"
              aria-pressed={safePace === preset}
              aria-label={`${preset} per day`}
              onClick={() => onChange(preset)}
              style={{
                background: safePace === preset ? 'var(--import-card-active-border)' : 'none',
                color: safePace === preset ? 'var(--text-white)' : 'var(--text-normal)',
                border: `1px solid ${safePace === preset ? 'var(--import-card-active-border)' : 'var(--import-counter-border)'}`,
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 11,
                fontFamily: mono,
                cursor: 'pointer',
              }}
            >
              {preset}
            </button>
          ))}
        </div>

        <div
          className="strategy-pace-stepper"
          style={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid var(--import-counter-border)',
            borderRadius: 4,
            background: 'var(--import-counter-bg)',
          }}
        >
          <button
            type="button"
            aria-label="Fewer per day"
            disabled={safePace <= 1}
            onClick={() => onChange(Math.max(1, safePace - 1))}
            style={{
              background: 'transparent',
              border: 'none',
              color: safePace <= 1 ? 'var(--text-faint)' : 'var(--text-normal)',
              padding: '2px 6px',
              fontSize: 12,
              cursor: safePace <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            −
          </button>
          <span
            aria-live="polite"
            style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--text-white)', padding: '0 4px', minWidth: 20, textAlign: 'center' }}
          >
            {safePace}
          </span>
          <button
            type="button"
            aria-label="More per day"
            disabled={safePace >= 100}
            onClick={() => onChange(Math.min(100, safePace + 1))}
            style={{
              background: 'transparent',
              border: 'none',
              color: safePace >= 100 ? 'var(--text-faint)' : 'var(--text-normal)',
              padding: '2px 6px',
              fontSize: 12,
              cursor: safePace >= 100 ? 'not-allowed' : 'pointer',
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function StrategyCard({
  value,
  selected,
  title,
  badge,
  children,
  extra,
  onSelect,
  onArrow,
}: {
  value: ImportStrategy;
  selected: boolean;
  title: string;
  badge?: string;
  children: ReactNode;
  extra?: ReactNode;
  onSelect: (v: ImportStrategy) => void;
  onArrow: (e: KeyboardEvent<HTMLDivElement>, v: ImportStrategy) => void;
}) {
  const id = `strategy-${value}`;
  return (
    <div
      id={id}
      className="strategy-card"
      role="radio"
      aria-checked={selected}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-desc`}
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(value)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onSelect(value);
        } else onArrow(e, value);
      }}
      style={{
        background: selected ? 'var(--import-card-active-bg)' : 'var(--import-card-inactive-bg)',
        border: `1px solid ${selected ? 'var(--import-card-active-border)' : 'var(--import-card-inactive-border)'}`,
        borderRadius: 6,
        padding: '14px 16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          border: `1px solid ${selected ? 'var(--text-white)' : 'var(--text-subtle)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
          flexShrink: 0,
        }}
      >
        {selected && <div style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--text-white)' }} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span id={`${id}-title`} style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-white)' }}>
            {title}
          </span>
          {badge && (
            <span
              style={{
                fontFamily: mono,
                fontSize: 10,
                color: 'var(--text-dim)',
                border: '1px solid var(--import-card-inactive-border)',
                padding: '1px 5px',
                borderRadius: 4,
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <p id={`${id}-desc`} style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: 0, marginTop: 4, lineHeight: 1.5 }}>
          {children}
        </p>
        {selected && extra}
      </div>
    </div>
  );
}

export function StrategyPickerStep({
  strategy,
  onStrategyChange,
  dailyPace,
  onDailyPaceChange,
  totalProblems,
  onContinue,
  onBack,
  hasSchedule = false,
  firstIntervalDays = 3,
  isBusy = false,
}: StrategyPickerStepProps) {
  const safePace = Math.max(1, dailyPace || 1);
  const staggeredDays = Math.max(1, Math.ceil(totalProblems / safePace));
  const strong = { color: 'var(--text-white)' };

  const options: ImportStrategy[] = [...(hasSchedule ? (['preserve'] as const) : []), 'staggered', 'fresh', 'archive'];

  // Arrow keys move the selection, as in a native radio group.
  const onArrow = (e: KeyboardEvent<HTMLDivElement>, current: ImportStrategy) => {
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = options[(options.indexOf(current) + delta + options.length) % options.length];
    onStrategyChange(next);
    document.getElementById(`strategy-${next}`)?.focus();
  };
  const cardProps = (value: ImportStrategy) => ({
    value,
    selected: strategy === value,
    onSelect: onStrategyChange,
    onArrow,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div>
        <h3 id="strategy-heading" style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-white)', margin: 0, marginBottom: 4 }}>
          Revision Schedule
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
          Determine how these {totalProblems.toLocaleString()} problems enter your spaced repetition rotation.
        </p>
      </div>

      {/* Options */}
      <div role="radiogroup" aria-labelledby="strategy-heading" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {hasSchedule && (
          <StrategyCard {...cardProps('preserve')} title="Keep schedule from file" badge="RESTORE">
            Each problem keeps its <strong style={strong}>status, ladder step and next review date</strong> from the file.
            Rows without schedule data start fresh.
          </StrategyCard>
        )}

        <StrategyCard
          {...cardProps('staggered')}
          title="Spread out"
          badge={hasSchedule ? undefined : 'RECOMMENDED'}
          extra={<PaceSelector safePace={safePace} onChange={onDailyPaceChange} label="Daily pace" />}
        >
          Revisions are staggered across the next <strong style={strong}>~{staggeredDays} {staggeredDays === 1 ? 'day' : 'days'}</strong> so
          you get ~{safePace} problems/day instead of everything hitting at once.
        </StrategyCard>

        <StrategyCard {...cardProps('fresh')} title="Start fresh">
          Each problem starts at Step 0 with its first review <strong style={strong}>{firstIntervalDays} {firstIntervalDays === 1 ? 'day' : 'days'} after its solve date</strong>.
          Problems solved long ago are due right away.
        </StrategyCard>

        <StrategyCard
          {...cardProps('archive')}
          title="No revisions"
          extra={<PaceSelector safePace={safePace} onChange={onDailyPaceChange} label="Rechecks per day" />}
        >
          Problems are imported as <strong style={strong}>Mastered</strong> and stay out of daily reviews. Each comes back once
          for a recheck starting in {MASTERY_RECHECK_DAYS} days, spread ~{safePace}/day.
        </StrategyCard>
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <button
          type="button"
          onClick={onBack}
          disabled={isBusy}
          style={{
            background: 'none',
            border: '1px solid var(--import-back-btn-border)',
            borderRadius: 6,
            color: 'var(--import-back-btn-color)',
            fontSize: 13,
            padding: '6px 14px',
            cursor: isBusy ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--import-back-btn-hover-border)'; e.currentTarget.style.color = 'var(--text-white)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--import-back-btn-border)'; e.currentTarget.style.color = 'var(--import-back-btn-color)'; }}
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Back
        </button>

        <button
          type="button"
          onClick={onContinue}
          disabled={isBusy}
          aria-busy={isBusy}
          style={{
            background: 'var(--primary)',
            border: 'none',
            borderRadius: 6,
            color: 'var(--primary-foreground)',
            fontSize: 13,
            fontWeight: 500,
            padding: '6px 16px',
            cursor: isBusy ? 'wait' : 'pointer',
            opacity: isBusy ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {isBusy ? (
            <>
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              Checking rows...
            </>
          ) : (
            <>
              Review Summary
              <ArrowRight size={13} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
