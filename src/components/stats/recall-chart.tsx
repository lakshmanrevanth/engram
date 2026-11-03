'use client';

import type { WeekPoint } from '@/app/api/stats/compute';
import { ChartTooltip, SrTable, TooltipRow, pct, shortDate, useActiveIndex, useElementWidth } from './chart-utils';

const H = 200;
const M = { top: 14, right: 36, bottom: 26, left: 38 };
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1];

/** Weekly clean-recall rate (single series, so no legend: the card title names it). */
export function RecallChart({ weeks }: { weeks: WeekPoint[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const { active, setActive, containerProps } = useActiveIndex(weeks.length);

  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;
  const band = weeks.length ? plotW / weeks.length : 0;
  const xAt = (i: number) => M.left + band * (i + 0.5);
  const yAt = (v: number) => M.top + plotH * (1 - v);

  // Line segments join consecutive weeks that have reviews; empty weeks leave a gap.
  const segments: string[] = [];
  let current = '';
  weeks.forEach((w, i) => {
    if (w.cleanRate === null) {
      if (current) segments.push(current);
      current = '';
    } else current += `${current ? 'L' : 'M'}${xAt(i)},${yAt(w.cleanRate)}`;
  });
  if (current) segments.push(current);

  const labelEvery = Math.max(1, Math.ceil(56 / Math.max(1, band)));
  const lastIdx = weeks.reduce((acc, w, i) => (w.cleanRate !== null ? i : acc), -1);
  const withData = weeks.filter((w) => w.reviews > 0);
  const summary = withData.length
    ? `Line chart of weekly clean recall rate over the last ${weeks.length} weeks. ${withData.length} weeks have reviews; ` +
      `the latest week with reviews (${shortDate(weeks[lastIdx].weekStart)}) was ${pct(weeks[lastIdx].cleanRate)} clean. Use arrow keys to read each week.`
    : `No reviews in the last ${weeks.length} weeks.`;
  const a = active !== null ? weeks[active] : null;

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
            {Y_TICKS.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={width - M.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--viz-grid)" strokeWidth={1} shapeRendering="crispEdges" />
                <text x={M.left - 8} y={yAt(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t * 100}%
                </text>
              </g>
            ))}
            {weeks.map((w, i) =>
              i % labelEvery === (weeks.length - 1) % labelEvery ? (
                <text key={w.weekStart} x={xAt(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                  {shortDate(w.weekStart)}
                </text>
              ) : null,
            )}
            {a && <line x1={xAt(active!)} x2={xAt(active!)} y1={M.top} y2={M.top + plotH} stroke="var(--text-muted)" strokeWidth={1} shapeRendering="crispEdges" />}
            {segments.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="var(--viz-ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {weeks.map((w, i) =>
              w.cleanRate === null ? null : (
                <circle
                  key={w.weekStart}
                  cx={xAt(i)}
                  cy={yAt(w.cleanRate)}
                  r={active === i ? 5.5 : 4}
                  fill="var(--viz-ink)"
                  stroke="var(--viz-surface)"
                  strokeWidth={2}
                />
              ),
            )}
            {lastIdx >= 0 && (
              <text x={xAt(lastIdx) + 9} y={yAt(weeks[lastIdx].cleanRate!)} dy="0.32em" fontSize={11.5} fontWeight={600} fill="var(--foreground)">
                {pct(weeks[lastIdx].cleanRate)}
              </text>
            )}
            {/* Hit bands: the whole column height snaps to the nearest week. */}
            {weeks.map((w, i) => (
              <rect
                key={w.weekStart}
                className="rc-stats-hit"
                x={M.left + band * i}
                y={M.top}
                width={band}
                height={plotH}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
                onPointerMove={() => setActive(i)}
              />
            ))}
          </svg>
        )}
        {a && (
          <ChartTooltip x={xAt(active!)} y={a.cleanRate === null ? M.top + plotH / 2 : yAt(a.cleanRate) - 10} containerWidth={width}>
            <div style={{ fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Week of {shortDate(a.weekStart)}</div>
            {a.reviews === 0 ? (
              <div>No reviews</div>
            ) : (
              <>
                <TooltipRow value={pct(a.cleanRate)} label="clean recall" swatch="var(--viz-ink)" />
                <TooltipRow value={a.reviews} label={a.reviews === 1 ? 'review' : 'reviews'} />
                <TooltipRow value={a.clean} label="clean" />
                <TooltipRow value={a.shaky} label="shaky" />
                <TooltipRow value={a.struggled} label="struggled" />
              </>
            )}
          </ChartTooltip>
        )}
      </div>
      <div aria-live="polite" className="sr-only">
        {a ? `Week of ${shortDate(a.weekStart)}: ${a.reviews ? `${pct(a.cleanRate)} clean, ${a.reviews} reviews (${a.clean} clean, ${a.shaky} shaky, ${a.struggled} struggled)` : 'no reviews'}` : ''}
      </div>
      <SrTable
        caption="Clean recall rate by week"
        head={['Week starting', 'Reviews', 'Clean', 'Shaky', 'Struggled', 'Clean rate']}
        rows={weeks.map((w) => [w.weekStart, w.reviews, w.clean, w.shaky, w.struggled, pct(w.cleanRate)])}
      />
    </div>
  );
}
