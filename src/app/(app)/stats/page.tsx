'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useSyncExternalStore } from 'react';
import type { StatsPayload } from '@/app/api/stats/compute';
import { fetcher } from '@/lib/fetcher';
import { StatsCard, StatsStyles } from '@/components/stats/stats-card';
import { KpiTiles } from '@/components/stats/kpi-tiles';
import { RecallChart } from '@/components/stats/recall-chart';
import { UpcomingChart } from '@/components/stats/upcoming-chart';
import { WeakTopics } from '@/components/stats/weak-topics';
import { LadderChart } from '@/components/stats/ladder-chart';
import { KindCompare } from '@/components/stats/kind-compare';

const noopSubscribe = () => () => {};

const buttonStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--input-border)',
  borderRadius: 6,
  color: 'var(--foreground)',
  fontSize: 13,
  padding: '6px 14px',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
} as const;

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading stats" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="rc-stats-kpis">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ height: 92, borderRadius: 8, border: '1px solid var(--daily-card-border)', background: 'var(--daily-row-skeleton)', opacity: 0.6 }} />
        ))}
      </div>
      <div className="rc-stats-grid">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} style={{ height: 270, borderRadius: 8, border: '1px solid var(--daily-card-border)', background: 'var(--daily-row-skeleton)', opacity: 0.6 }} />
        ))}
      </div>
    </div>
  );
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function StatsPage() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<StatsPayload | null>('/api/stats', fetcher);
  // SWR's cache is persisted to localStorage, so the browser's first render may already
  // have data the server didn't. Only render data after hydration to avoid a mismatch.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const stats = hydrated && data && Array.isArray(data.recallRate) ? data : null;

  let body: React.ReactNode;
  if (!hydrated || (!stats && isLoading)) {
    body = <Skeleton />;
  } else if (!stats && error) {
    body = (
      <div role="alert" style={{ border: '1px solid var(--error-border)', borderRadius: 8, padding: '32px 16px', textAlign: 'center', color: 'var(--text-normal)', fontSize: 14 }}>
        Couldn&apos;t load your stats.
        <div>
          <button type="button" onClick={() => mutate()} disabled={isValidating} style={{ ...buttonStyle, marginTop: 12, opacity: isValidating ? 0.6 : 1 }}>
            {isValidating ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      </div>
    );
  } else if (!stats) {
    body = <Skeleton />;
  } else {
    const items = stats.totals.active + stats.totals.mastered + stats.totals.retired;
    const hasReviews = stats.totals.reviewsAllTime > 0;
    const upcomingTotal = stats.upcoming.reduce((n, d) => n + d.count, 0);

    const upcomingCard = (
      <StatsCard
        id="stats-upcoming"
        title="Upcoming reviews (next 30 days)"
        subtitle={
          upcomingTotal
            ? `${plural(upcomingTotal, 'review')} scheduled${stats.overdueCount ? ` · ${stats.overdueCount} overdue counted on today` : ''}`
            : 'Nothing scheduled in the next 30 days'
        }
      >
        <UpcomingChart days={stats.upcoming} overdueCount={stats.overdueCount} />
      </StatsCard>
    );
    const ladderCard = (
      <StatsCard id="stats-ladder" title="Where your items are on the ladder" subtitle="Active items by review step, plus mastered items">
        <LadderChart steps={stats.ladder.steps} mastered={stats.ladder.mastered} ladderDays={stats.ladderDays} />
      </StatsCard>
    );

    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: isValidating && error ? 0.7 : 1 }}>
        {error && (
          <div role="status" style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            Showing saved stats; the latest couldn&apos;t load.
            <button type="button" onClick={() => mutate()} style={{ ...buttonStyle, padding: '3px 10px', fontSize: 12 }}>
              Retry
            </button>
          </div>
        )}
        {!hasReviews ? (
          <>
            <div style={{ border: '1px dashed var(--daily-card-border)', borderRadius: 8, padding: '36px 16px', textAlign: 'center', background: 'var(--daily-card-bg)' }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--foreground)', margin: '0 0 6px' }}>Review a few problems and your stats appear here</p>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 16px' }}>
                {items ? `You're tracking ${plural(items, 'item')}. Rate your first reviews to see your recall rate and weak spots.` : 'Add a problem or a concept to get started.'}
              </p>
              <Link href={items ? '/daily' : '/dashboard'} style={buttonStyle}>
                {items ? 'Go to the daily queue' : 'Go to the dashboard'}
              </Link>
            </div>
            {items > 0 && (
              <div className="rc-stats-grid">
                {upcomingCard}
                {ladderCard}
              </div>
            )}
          </>
        ) : (
          <>
            <KpiTiles stats={stats} />
            <div className="rc-stats-grid">
              <StatsCard
                id="stats-recall"
                title="Recall rate by week"
                subtitle="Share of reviews rated clean, per week (Mon–Sun), last 12 weeks"
              >
                <RecallChart weeks={stats.recallRate} />
              </StatsCard>
              {upcomingCard}
              <StatsCard
                id="stats-weak"
                title="Weakest topics"
                subtitle="Last 90 days, by share of struggled reviews (shaky counts half). At least 3 reviews."
              >
                <WeakTopics topics={stats.weakestTopics} />
              </StatsCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                {ladderCard}
                <StatsCard id="stats-kinds" title="Problems vs concepts" subtitle="Last 90 days">
                  <KindCompare problems={stats.byKind.problems} concepts={stats.byKind.concepts} />
                </StatsCard>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rc-stats" style={{ maxWidth: 1150, margin: '0 auto', paddingBottom: 48 }}>
      <StatsStyles />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>Stats</h1>
        {stats && <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Days in {stats.timeZone.replace(/_/g, ' ')}</span>}
      </div>
      {body}
    </div>
  );
}
