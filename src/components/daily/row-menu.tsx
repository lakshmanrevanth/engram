'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export type RowMenuItem = {
  key: string;
  label: string;
  onSelect?: () => void;
  /** Renders a link (opens in a new tab) instead of a button. */
  href?: string;
  danger?: boolean;
  separatorBefore?: boolean;
};

type RowMenuProps = {
  items: RowMenuItem[];
  label: string;
  disabled?: boolean;
};

/** "⋯" menu button: aria-haspopup menu, arrow keys / Home / End, Esc closes and refocuses the button. */
export function RowMenu({ items, label, disabled }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const moveFocus = (delta: number | 'first' | 'last') => {
    const els = itemRefs.current.slice(0, items.length).filter((el): el is HTMLElement => !!el?.isConnected);
    if (els.length === 0) return;
    const i = els.indexOf(document.activeElement as HTMLElement);
    const next =
      delta === 'first' ? 0 : delta === 'last' ? els.length - 1 : (i + delta + els.length) % els.length;
    els[next].focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    // Keep row and page shortcuts from firing while the menu is open.
    e.stopPropagation();
    if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); }
    else if (e.key === 'Home') { e.preventDefault(); moveFocus('first'); }
    else if (e.key === 'End') { e.preventDefault(); moveFocus('last'); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') setOpen(false);
  };

  const itemStyle = (danger?: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '6px 10px',
    borderRadius: 5,
    background: 'transparent',
    border: 'none',
    color: danger ? 'var(--error)' : 'var(--text-normal)',
    fontSize: 12.5,
    fontWeight: 500,
    textAlign: 'left',
    textDecoration: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          borderRadius: 5,
          background: open ? 'var(--accent)' : 'transparent',
          border: 'none',
          color: 'var(--text-subtle)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            zIndex: 1000,
            minWidth: 170,
            padding: 4,
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-popover)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {items.map((item, i) => (
            <div key={item.key} role="none">
              {item.separatorBefore && (
                <div role="separator" style={{ height: 1, margin: '3px 4px', background: 'var(--border)' }} />
              )}
              {item.href ? (
                <a
                  ref={(el) => { itemRefs.current[i] = el; }}
                  role="menuitem"
                  tabIndex={-1}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => close(false)}
                  style={itemStyle(item.danger)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {item.label}
                </a>
              ) : (
                <button
                  ref={(el) => { itemRefs.current[i] = el; }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    close(true);
                    item.onSelect?.();
                  }}
                  style={itemStyle(item.danger)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {item.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
