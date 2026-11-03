'use client';

// Small building blocks shared by the settings page sections.

import { useCallback, useEffect, useRef, useState } from 'react';

export const cardStyle: React.CSSProperties = {
  background: 'var(--settings-card-bg)',
  border: '1px solid var(--settings-card-border)',
  borderRadius: 10,
  padding: 24,
  boxShadow: 'var(--shadow-modal)',
};

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-dim)',
  marginBottom: 6,
};

export const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-subtle)',
  marginTop: 6,
  display: 'block',
  lineHeight: 1.5,
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--foreground)',
  outline: 'none',
  transition: 'border-color 0.15s',
};

export const actionBtnStyle: React.CSSProperties = {
  background: 'var(--settings-action-btn-bg)',
  border: '1px solid var(--settings-action-btn-border)',
  borderRadius: 6,
  color: 'var(--settings-action-btn-color)',
  fontSize: 12,
  fontWeight: 500,
  padding: '8px 14px',
  cursor: 'pointer',
  transition: 'background 0.15s',
  whiteSpace: 'nowrap',
};

export const dangerBtnStyle: React.CSSProperties = {
  background: 'var(--error-bg)',
  border: '1px solid var(--error-border)',
  borderRadius: 6,
  color: 'var(--error)',
  fontSize: 12,
  fontWeight: 500,
  padding: '8px 14px',
  cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
  whiteSpace: 'nowrap',
};

export function Card({
  title,
  icon,
  id,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section data-settings-card id={id} aria-labelledby={headingId} style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <span aria-hidden="true" style={{ color: 'var(--text-dim)', display: 'inline-flex' }}>
          {icon}
        </span>
        <h2 id={headingId} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)', margin: 0 }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export function ActionButton({
  children,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      {...props}
      style={{ ...actionBtnStyle, ...(props.disabled ? { opacity: 0.6, cursor: 'not-allowed' } : {}), ...style }}
      onMouseEnter={(e) => {
        if (!props.disabled) e.currentTarget.style.background = 'var(--settings-action-btn-hover-bg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = (style?.background as string) ?? 'var(--settings-action-btn-bg)';
      }}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      {...props}
      style={{ ...dangerBtnStyle, ...(props.disabled ? { opacity: 0.55, cursor: 'not-allowed' } : {}), ...style }}
    >
      {children}
    </button>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 36,
        height: 20,
        flexShrink: 0,
        borderRadius: 999,
        border: '1px solid var(--input-border)',
        background: checked ? 'var(--success)' : 'var(--input-bg)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.15s',
        padding: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: checked ? '#ffffff' : 'var(--text-dim)',
          transition: 'left 0.15s',
        }}
      />
    </button>
  );
}

export type SaveState = { status: 'idle' | 'saving' | 'saved' | 'error'; message?: string };

/** Tracks saving/saved/error for one section. "Saved" fades after a few seconds. */
export function useSaveState() {
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const run = useCallback(async <T,>(fn: () => Promise<T>, savedMessage = 'Saved'): Promise<T | undefined> => {
    if (timer.current) window.clearTimeout(timer.current);
    setState({ status: 'saving' });
    try {
      const result = await fn();
      setState({ status: 'saved', message: savedMessage });
      timer.current = window.setTimeout(() => setState({ status: 'idle' }), 3000);
      return result;
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Something went wrong' });
      return undefined;
    }
  }, []);

  const fail = useCallback((message: string) => setState({ status: 'error', message }), []);
  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, run, fail, reset };
}

export function StatusText({ state, style }: { state: SaveState; style?: React.CSSProperties }) {
  let content: React.ReactNode = null;
  let color = 'var(--text-muted)';
  if (state.status === 'saving') content = 'Saving…';
  if (state.status === 'saved') {
    color = 'var(--success)';
    content = `✓ ${state.message ?? 'Saved'}`;
  }
  if (state.status === 'error') {
    color = 'var(--error)';
    content = state.message ?? 'Could not save';
  }
  return (
    <div
      role={state.status === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      style={{ fontSize: 12, color, minHeight: 16, marginTop: 6, ...style }}
    >
      {content}
    </div>
  );
}

/** fetch + JSON with the server's error message turned into a thrown Error. */
export async function requestJson<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error('Network error. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || `Request failed (${res.status})`) as Error & {
      code?: string;
      status?: number;
    };
    err.code = (data as { code?: string }).code;
    err.status = res.status;
    throw err;
  }
  return data as T;
}
