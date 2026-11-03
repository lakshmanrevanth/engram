import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { StatsPayload } from '@/app/api/stats/compute';
import { pct } from './chart-utils';

function Tile({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--daily-card-border)', borderRadius: 8, background: 'var(--daily-card-bg)', padding: '12px 14px', minWidth: 0 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
      {detail && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>{detail}</div>}
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString('en-US');

function Delta({ change }: { change: number | null }) {
  if (change === null) return <>No reviews in the 90 days before</>;
  const pts = Math.round(change * 100);
  const Icon = pts > 0 ? ArrowUpRight : pts < 0 ? ArrowDownRight : Minus;
  const color = pts > 0 ? 'var(--success)' : pts < 0 ? 'var(--error)' : 'var(--text-muted)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
      <Icon size={13} aria-hidden="true" style={{ color }} />
      <span style={{ color, fontWeight: 600 }}>
        {pts > 0 ? '+' : pts < 0 ? '−' : '±'}
        {Math.abs(pts)} pts
      </span>
      <span>vs previous 90 days</span>
    </span>
  );
}

export function KpiTiles({ stats }: { stats: StatsPayload }) {
  const { totals } = stats;
  const items = totals.active + totals.mastered + totals.retired;
  const dueToday = stats.upcoming[0]?.count ?? 0;
  return (
    <div className="rc-stats-kpis">
      <Tile label="Reviews, last 30 days" value={fmt(totals.reviewsLast30)} detail={`${fmt(totals.reviewsAllTime)} all time`} />
      <Tile
        label="Clean recall, 90 days"
        value={pct(stats.overallCleanRate)}
        detail={stats.reviewsLast90 ? <Delta change={stats.cleanRateChange} /> : 'No reviews in the last 90 days'}
      />
      <Tile label="Mastered" value={fmt(totals.mastered)} detail={`of ${fmt(items)} tracked`} />
      <Tile
        label="Overdue now"
        value={fmt(stats.overdueCount)}
        detail={dueToday ? `${fmt(dueToday)} due today in total` : 'Nothing due today'}
      />
    </div>
  );
}
