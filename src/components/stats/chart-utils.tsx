'use client';

// Small shared pieces for the Stats page's inline-SVG charts: container width,
// keyboard/pointer focus on one data index, tooltip box, nice ticks, formatters.

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';

/** Width of a container element, kept up to date with a ResizeObserver. 0 until measured. */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 0);
      setWidth((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * One "active" data index shared by hover and keyboard. The chart container is a single
 * tab stop; ←/→ (and Home/End) move between points, Escape clears.
 */
export function useActiveIndex(length: number, initial: 'first' | 'last' = 'last') {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!length) return;
      let next: number | null = null;
      const cur = active ?? (initial === 'last' ? length - 1 : 0);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(length - 1, active === null ? cur : cur + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, active === null ? cur : cur - 1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = length - 1;
      else if (e.key === 'Escape') {
        setActive(null);
        return;
      } else return;
      e.preventDefault();
      setActive(next);
    },
    [active, length, initial],
  );
  const containerProps = {
    tabIndex: 0,
    onKeyDown,
    onFocus: () => setActive((a) => a ?? (length ? (initial === 'last' ? length - 1 : 0) : null)),
    onBlur: () => setActive(null),
    onPointerLeave: () => setActive(null),
  };
  return { active, setActive, containerProps };
}

/** Round-number ticks from 0 to at least `max`. */
export function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const stepInt = Math.max(1, Math.ceil(step));
  const ticks: number[] = [];
  for (let v = 0; v < max + stepInt; v += stepInt) {
    ticks.push(v);
    if (v >= max) break;
  }
  return ticks;
}

export const pct = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits)}%`);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "Nov 3" from "2026-11-03" (no timezone conversion: the key is already a local day). */
export function shortDate(key: string) {
  const [, m, d] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}
export function weekdayDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${MONTHS[m - 1]} ${d}`;
}

/** SVG path for a bar with 4px rounded top corners and a square base. */
export function topRoundedBar(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0 || w <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** SVG path for a horizontal bar with a square start and a 4px rounded end. */
export function rightRoundedBar(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0 || w <= 0) return '';
  const rr = Math.min(r, h / 2, w);
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}

/** Tooltip box positioned over a chart; flips to stay inside the container. */
export function ChartTooltip({ x, y, containerWidth, children }: { x: number; y: number; containerWidth: number; children: ReactNode }) {
  const W = 176;
  const left = Math.max(0, Math.min(containerWidth - W, x - W / 2));
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left,
        top: Math.max(0, y),
        width: W,
        pointerEvents: 'none',
        background: 'var(--popover)',
        border: '1px solid var(--input-border)',
        borderRadius: 8,
        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
        padding: '8px 10px',
        fontSize: 12,
        color: 'var(--text-dim)',
        zIndex: 2,
        transform: 'translateY(-100%)',
      }}
    >
      {children}
    </div>
  );
}

export function TooltipRow({ value, label, swatch }: { value: ReactNode; label: string; swatch?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: '18px' }}>
      {swatch && <span style={{ width: 10, height: 2, borderRadius: 1, background: swatch, flex: '0 0 auto' }} />}
      <span style={{ fontWeight: 600, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span>{label}</span>
    </div>
  );
}

export function LegendItem({ color, label, shape = 'rect' }: { color: string; label: string; shape?: 'rect' | 'line' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}>
      <span
        aria-hidden="true"
        style={shape === 'rect' ? { width: 10, height: 10, borderRadius: 2, background: color } : { width: 14, height: 2, borderRadius: 1, background: color }}
      />
      {label}
    </span>
  );
}

export const focusRingStyle: CSSProperties = { outline: 'none', position: 'relative', borderRadius: 6 };

/** A visually hidden data table — the non-visual twin of a chart. */
export function SrTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
