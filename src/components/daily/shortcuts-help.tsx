'use client';

import { useEffect, useRef } from 'react';

export const TABLE_SHORTCUTS: [string[], string][] = [
  [['j'], 'Next problem'],
  [['k'], 'Previous problem'],
  [['Enter'], 'Recall first: open notes panel'],
  [['1'], 'Rate Clean'],
  [['2'], 'Rate Shaky'],
  [['3'], 'Rate Struggled'],
  [['u'], 'Undo the last rating'],
  [['Ctrl', 'Z'], 'Undo the last rating (⌘Z on Mac)'],
  [['f'], 'Focus mode'],
  [['?'], 'Show or hide this list'],
];

export const FOCUS_SHORTCUTS: [string[], string][] = [
  [['Space'], 'Reveal notes'],
  [['1', '2', '3'], 'Rate Clean / Shaky / Struggled'],
  [['s'], 'Snooze to tomorrow'],
  [['u'], 'Undo the last rating'],
  [['Esc'], 'Exit focus mode'],
];

type ShortcutsHelpProps = { id: string; onClose: () => void };

/** Non-modal popover listing keyboard shortcuts. Esc or clicking outside closes it. */
export function ShortcutsHelp({ id, onClose }: ShortcutsHelpProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(el) && !el.closest?.('[data-shortcuts-toggle]')) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const section = (title: string, rows: [string[], string][]) => (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '2px 0 6px' }}>
        {title}
      </div>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 12px', alignItems: 'center' }}>
        {rows.map(([keys, label]) => (
          <div key={label} style={{ display: 'contents' }}>
            <dt style={{ display: 'flex', gap: 3 }}>
              {keys.map((k) => (
                <kbd key={k} className="rc-kbd">{k}</kbd>
              ))}
            </dt>
            <dd style={{ margin: 0, fontSize: 12.5, color: 'var(--text-normal)' }}>{label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <div
      id={id}
      ref={ref}
      role="dialog"
      aria-label="Keyboard shortcuts"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === '?') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        right: 0,
        zIndex: 1000,
        width: 'min(300px, calc(100vw - 32px))',
        padding: 14,
        background: 'var(--popover)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: 'var(--shadow-modal)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        outline: 'none',
      }}
    >
      {section('Daily list', TABLE_SHORTCUTS)}
      {section('Focus mode', FOCUS_SHORTCUTS)}
    </div>
  );
}
