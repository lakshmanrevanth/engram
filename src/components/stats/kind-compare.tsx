import type { KindStats } from '@/app/api/stats/compute';
import { pct } from './chart-utils';

function Column({ name, color, stats }: { name: string; color: string; stats: KindStats }) {
  const rate = stats.cleanRate90;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 10 }}>
        <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
        {name}
      </div>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: 6, fontSize: 12.5 }}>
        <dt style={{ color: 'var(--text-dim)' }}>Tracked</dt>
        <dd style={{ margin: 0, textAlign: 'right', fontWeight: 600, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{stats.items}</dd>
        <dt style={{ color: 'var(--text-dim)' }}>Reviews (90d)</dt>
        <dd style={{ margin: 0, textAlign: 'right', fontWeight: 600, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{stats.reviews90}</dd>
        <dt style={{ color: 'var(--text-dim)' }}>Clean recall</dt>
        <dd style={{ margin: 0, textAlign: 'right', fontWeight: 600, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{pct(rate)}</dd>
      </dl>
      <div
        role="meter"
        aria-label={`${name} clean recall rate`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rate === null ? undefined : Math.round(rate * 100)}
        aria-valuetext={rate === null ? 'No reviews' : pct(rate)}
        style={{ marginTop: 10, height: 8, borderRadius: 4, background: 'var(--daily-section-bg)', overflow: 'hidden' }}
      >
        {rate !== null && rate > 0 && <div style={{ width: `${rate * 100}%`, minWidth: 4, height: '100%', borderRadius: 4, background: color }} />}
      </div>
    </div>
  );
}

/** Problems vs concepts: how many, how often reviewed, how cleanly recalled (90 days). */
export function KindCompare({ problems, concepts }: { problems: KindStats; concepts: KindStats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20 }}>
      <Column name="Problems" color="var(--viz-problem)" stats={problems} />
      <Column name="Concepts" color="var(--viz-concept)" stats={concepts} />
    </div>
  );
}
