import Link from 'next/link';
import type { WeakTopic } from '@/app/api/stats/compute';
import { pct } from './chart-utils';

const KIND_LABEL: Record<WeakTopic['kind'], string> = { problem: 'Problems', concept: 'Concepts', mixed: 'Mixed' };

function KindTag({ kind }: { kind: WeakTopic['kind'] }) {
  const dots = kind === 'mixed' ? ['var(--viz-problem)', 'var(--viz-concept)'] : [kind === 'concept' ? 'var(--viz-concept)' : 'var(--viz-problem)'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
      {dots.map((c) => (
        <span key={c} aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: c }} />
      ))}
      {KIND_LABEL[kind]}
    </span>
  );
}

/** Ranked list: topics with the biggest share of struggled (+½ shaky) reviews in the last 90 days. */
export function WeakTopics({ topics }: { topics: WeakTopic[] }) {
  if (!topics.length) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0, lineHeight: 1.6 }}>
        No weak spots yet. A topic shows up here once it has at least 3 reviews in the last 90 days and some of them were shaky or a struggle.
      </p>
    );
  }
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {topics.map((t, i) => {
        const label = `${t.topic}: ${pct(t.struggleRate)} struggle share, ${pct(t.cleanRate)} clean over ${t.reviews} reviews (${t.struggled} struggled, ${t.shaky} shaky). Open in the dashboard.`;
        return (
          <li key={t.topic}>
            <Link
              href={`/dashboard?topic=${encodeURIComponent(t.topic)}`}
              className="rc-topic-link"
              aria-label={label}
              title={`${t.struggled} struggled · ${t.shaky} shaky · ${t.clean} clean`}
              style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr) auto', alignItems: 'center', columnGap: 10, rowGap: 6, padding: '8px 6px', borderRadius: 6, textDecoration: 'none', color: 'inherit' }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic}</span>
                <KindTag kind={t.kind} />
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--text-dim)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{pct(t.struggleRate)}</span> struggle
              </span>
              <span />
              <span aria-hidden="true" style={{ height: 6, borderRadius: 3, background: 'var(--daily-section-bg)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${Math.min(100, t.struggleRate * 100)}%`, minWidth: 4, borderRadius: 3, background: 'var(--viz-ink)' }} />
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {t.reviews} reviews · {pct(t.cleanRate)} clean
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
