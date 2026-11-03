'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, X, Check } from 'lucide-react';

type Confidence = 'CLEAN' | 'SHAKY' | 'STRUGGLED';

export type UndoToastData = {
  problemId: string;
  revisionId?: string | null;
  title: string;
  confidence: Confidence;
};

export type ToastItem =
  | { id: string; kind: 'success' | 'error'; message: string }
  | ({ id: string; kind: 'undo' } & UndoToastData);

export type NewToast =
  | { kind: 'success' | 'error'; message: string }
  | ({ kind: 'undo' } & UndoToastData);

const MAX_TOASTS = 5;
const DURATION = { success: 3000, error: 5000, undo: 7000 } as const;

const CONFIDENCE_COLORS = {
  CLEAN: { text: '#34d399', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' },
  SHAKY: { text: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' },
  STRUGGLED: { text: '#f87171', bg: 'rgba(248, 113, 113, 0.15)', border: 'rgba(248, 113, 113, 0.3)' },
};

let seq = 0;

/** One queue for every toast on the page. Undo toasts each keep their own problem + revision. */
export function useToastStack() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((t: NewToast) => {
    const id = `t${++seq}`;
    setToasts((prev) => {
      // A new undo for the same problem replaces the old one.
      const rest = t.kind === 'undo' ? prev.filter((p) => !(p.kind === 'undo' && p.problemId === t.problemId)) : prev;
      return [...rest, { ...t, id } as ToastItem].slice(-MAX_TOASTS);
    });
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissUndoFor = useCallback((problemId: string) => {
    setToasts((prev) => prev.filter((t) => !(t.kind === 'undo' && t.problemId === problemId)));
  }, []);

  const latestUndo = [...toasts].reverse().find((t) => t.kind === 'undo') as
    | Extract<ToastItem, { kind: 'undo' }>
    | undefined;

  return { toasts, push, dismiss, dismissUndoFor, latestUndo };
}

type ToastStackProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onUndo: (toast: Extract<ToastItem, { kind: 'undo' }>) => Promise<void> | void;
};

/** A single live region, newest at the bottom; toasts never overlap. */
export function ToastStack({ toasts, onDismiss, onUndo }: ToastStackProps) {
  return (
    <div className="rc-toast-region" role="region" aria-label="Notifications" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={onDismiss} onUndo={onUndo} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
  onUndo,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  onUndo: ToastStackProps['onUndo'];
}) {
  const duration = DURATION[toast.kind];
  const [paused, setPaused] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const remaining = useRef<number>(duration);

  // Auto-dismiss, paused while hovered or focused.
  useEffect(() => {
    if (paused || isUndoing) return;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - started));
    };
  }, [paused, isUndoing, onDismiss, toast.id]);

  const accent =
    toast.kind === 'undo'
      ? CONFIDENCE_COLORS[toast.confidence]?.text ?? CONFIDENCE_COLORS.CLEAN.text
      : toast.kind === 'error'
        ? 'var(--error)'
        : 'var(--text-muted)';

  const handleUndo = async () => {
    if (toast.kind !== 'undo' || isUndoing) return;
    setIsUndoing(true);
    try {
      await onUndo(toast);
    } finally {
      onDismiss(toast.id);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      style={{
        background: 'var(--popover)',
        border: toast.kind === 'error' ? '1px solid var(--error-border)' : '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: 'var(--shadow-modal)',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', gap: 12 }}>
        {toast.kind === 'undo' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: CONFIDENCE_COLORS[toast.confidence].bg,
                color: CONFIDENCE_COLORS[toast.confidence].text,
                border: `1px solid ${CONFIDENCE_COLORS[toast.confidence].border}`,
                flexShrink: 0,
              }}
            >
              <Check size={13} strokeWidth={2.5} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {toast.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
                Marked as{' '}
                <span style={{ color: CONFIDENCE_COLORS[toast.confidence].text, fontWeight: 600 }}>
                  {toast.confidence.charAt(0) + toast.confidence.slice(1).toLowerCase()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: toast.kind === 'error' ? 'var(--error)' : 'var(--foreground)',
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}
          >
            {toast.message}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {toast.kind === 'undo' && (
            <button
              type="button"
              onClick={handleUndo}
              disabled={isUndoing}
              aria-label={`Undo rating for ${toast.title}`}
              aria-keyshortcuts="Control+Z Meta+Z"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                background: 'var(--secondary)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                cursor: isUndoing ? 'not-allowed' : 'pointer',
              }}
            >
              <RotateCcw size={12} className={isUndoing ? 'animate-spin' : ''} />
              {isUndoing ? 'Undoing...' : 'Undo'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 4,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-subtle)',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Time left; stops while paused */}
      <div style={{ width: '100%', height: 2, background: 'var(--border-subtle)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            background: accent,
            transformOrigin: 'left',
            animation: `rc-toast-progress ${duration}ms linear forwards`,
            animationPlayState: paused || isUndoing ? 'paused' : 'running',
          }}
        />
      </div>
    </motion.div>
  );
}
