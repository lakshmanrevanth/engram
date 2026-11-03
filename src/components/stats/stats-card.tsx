import type { ReactNode } from 'react';

/** Scoped colour tokens + layout rules for the Stats page (light and `.dark`). */
export function StatsStyles() {
  return (
    <style>{`
      .rc-stats {
        /* Identity colours (validated categorical slots 1–2): problems = blue, concepts = orange. */
        --viz-problem: #2a78d6;
        --viz-concept: #eb6834;
        --viz-ink: var(--foreground);
        --viz-grid: var(--input-border);
        --viz-surface: var(--daily-card-bg);
      }
      .dark .rc-stats {
        --viz-problem: #3987e5;
        --viz-concept: #d95926;
      }
      .rc-stats-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
      .rc-stats-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
      @media (max-width: 900px) { .rc-stats-grid { grid-template-columns: minmax(0, 1fr); } }
      @media (max-width: 720px) { .rc-stats-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .rc-stats [data-chart]:focus-visible { box-shadow: 0 0 0 2px var(--focus-ring); }
      .rc-stats a.rc-topic-link:hover { background: var(--table-row-hover); }
      .rc-stats a.rc-topic-link:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
      .rc-stats-hit { cursor: default; }
    `}</style>
  );
}

export function StatsCard({
  id,
  title,
  subtitle,
  children,
  aside,
}: {
  id: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      style={{
        border: '1px solid var(--daily-card-border)',
        borderRadius: 8,
        background: 'var(--daily-card-bg)',
        padding: '16px 16px 14px',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h2 id={`${id}-title`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
            {title}
          </h2>
          {subtitle && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '3px 0 0', lineHeight: 1.5 }}>{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
