'use client';

import { ChartTooltip, SrTable, TooltipRow, rightRoundedBar, useActiveIndex, useElementWidth } from './chart-utils';

const ROW = 34;
const BAR = 14;
const LABEL_W = 112;
const VALUE_W = 40;

/** Horizontal bars: active items on each ladder step, then mastered. */
export function LadderChart({ steps, mastered, ladderDays }: { steps: number[]; mastered: number; ladderDays: number[] }) {
  const rows = [
    ...steps.map((count, i) => ({ label: `Step ${i + 1}`, sub: ladderDays[i] ? `${ladderDays[i]}-day gap` : '', count })),
    { label: 'Mastered', sub: 'rechecks only', count: mastered },
  ];
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const { active, setActive, containerProps } = useActiveIndex(rows.length, 'first');
  const total = rows.reduce((n, r) => n + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const plotW = Math.max(0, width - LABEL_W - VALUE_W);
  const H = rows.length * ROW;
  const summary = `Bar chart of items by ladder step: ${rows.map((r) => `${r.label} ${r.count}`).join(', ')}. Use arrow keys to read each row.`;
  const a = active !== null ? rows[active] : null;

  return (
    <div>
      <div
        ref={ref}
        data-chart
        role="group"
        aria-roledescription="chart"
        aria-label={summary}
        {...containerProps}
        style={{ position: 'relative', height: H, outline: 'none', borderRadius: 6 }}
      >
        {width > 0 && (
          <svg width={width} height={H} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
            <line x1={LABEL_W} x2={LABEL_W} y1={4} y2={H - 4} stroke="var(--text-faint)" strokeWidth={1} shapeRendering="crispEdges" />
            {rows.map((r, i) => {
              const y = i * ROW;
              const w = (r.count / max) * plotW;
              return (
                <g key={r.label} opacity={active !== null && active !== i ? 0.55 : 1}>
                  <text x={0} y={y + ROW / 2 - 6} dy="0.32em" fontSize={12.5} fontWeight={500} fill="var(--foreground)">
                    {r.label}
                  </text>
                  <text x={0} y={y + ROW / 2 + 8} dy="0.32em" fontSize={11} fill="var(--text-muted)">
                    {r.sub}
                  </text>
                  {r.count > 0 && <path d={rightRoundedBar(LABEL_W, y + (ROW - BAR) / 2, Math.max(2, w), BAR)} fill="var(--viz-ink)" />}
                  <text x={LABEL_W + Math.max(2, w) + 6} y={y + ROW / 2} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--foreground)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {r.count}
                  </text>
                  <rect
                    className="rc-stats-hit"
                    x={0}
                    y={y}
                    width={width}
                    height={ROW}
                    fill="transparent"
                    onPointerEnter={() => setActive(i)}
                    onPointerMove={() => setActive(i)}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {a && (
          <ChartTooltip x={LABEL_W + plotW / 2} y={active! * ROW + 2} containerWidth={width}>
            <div style={{ fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>{a.label}</div>
            <TooltipRow value={a.count} label={a.count === 1 ? 'item' : 'items'} swatch="var(--viz-ink)" />
            <TooltipRow value={total ? `${Math.round((a.count / total) * 100)}%` : '—'} label="of items in rotation" />
          </ChartTooltip>
        )}
      </div>
      <div aria-live="polite" className="sr-only">
        {a ? `${a.label}: ${a.count} ${a.count === 1 ? 'item' : 'items'}` : ''}
      </div>
      <SrTable caption="Items by ladder step" head={['Step', 'Items']} rows={rows.map((r) => [r.sub ? `${r.label} (${r.sub})` : r.label, r.count])} />
    </div>
  );
}
