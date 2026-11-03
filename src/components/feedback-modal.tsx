'use client';

import { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, ExternalLink, MessageSquare } from 'lucide-react';
import { siteConfig } from '@/config/site';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    // Remember what had focus so it can be restored on close.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      // Keep Tab inside the dialog.
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      const firstItem = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (firstItem ?? dialogRef.current)?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          data-feedback-modal-overlay
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          />

          {/* Dialog Content */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '480px',
              background: 'var(--feedback-modal-bg)',
              border: '1px solid var(--feedback-modal-border)',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: 'var(--shadow-modal)',
              color: 'var(--text-strong)',
              zIndex: 1,
              outline: 'none',
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close feedback dialog"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-strong)';
                e.currentTarget.style.background = 'var(--table-inline-edit-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(247, 152, 30, 0.12)',
                  border: '1px solid rgba(247, 152, 30, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F7981E',
                }}
              >
                <MessageSquare size={16} />
              </div>
              <h2 id={titleId} style={{ margin: 0, fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-strong)' }}>
                Feedback & Issues
              </h2>
            </div>

            <p id={descId} style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Help us improve {siteConfig.name} by reporting a bug or sharing a feature idea:
            </p>

            {/* Options — GitHub Issues Prioritized */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Option 1: GitHub Issue (only when a public repo is configured) */}
              {siteConfig.githubUrl ? (
              <a
                href={`${siteConfig.githubUrl}/issues/new`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '16px',
                  background: 'var(--feedback-card-gh-bg)',
                  border: '1px solid var(--feedback-card-gh-border)',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  color: 'var(--text-strong)',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--feedback-card-gh-hover-bg)';
                  e.currentTarget.style.borderColor = 'var(--feedback-card-gh-hover-border)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--feedback-card-gh-bg)';
                  e.currentTarget.style.borderColor = 'var(--feedback-card-gh-border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: 'var(--feedback-btn-gh-icon-bg)',
                    border: '1px solid var(--feedback-btn-gh-icon-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--feedback-btn-gh-icon-color)',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-strong)' }}>Open GitHub Issue</span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(247, 152, 30, 0.15)',
                          color: '#F7981E',
                          border: '1px solid rgba(247, 152, 30, 0.3)',
                          fontFamily: 'var(--font-geist-mono), monospace',
                        }}
                      >
                        Recommended
                      </span>
                    </div>
                    <ExternalLink size={13} style={{ color: 'var(--text-dim)' }} />
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-normal)', lineHeight: 1.4, display: 'block' }}>
                    Direct bug reports, feature requests, and transparent resolution tracking.
                  </span>
                </div>
              </a>
              ) : null}

              {/* Option 2: Email */}
              <a
                href={`mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(`${siteConfig.name} feedback`)}`}
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '14px 16px',
                  background: 'var(--feedback-card-form-bg)',
                  border: '1px solid var(--feedback-card-form-border)',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  color: 'var(--text-strong)',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--feedback-card-form-hover-bg)';
                  e.currentTarget.style.borderColor = 'var(--feedback-card-form-hover-border)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--feedback-card-form-bg)';
                  e.currentTarget.style.borderColor = 'var(--feedback-card-form-border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#60a5fa',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <Mail size={17} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-strong)' }}>Send an Email</span>
                    <ExternalLink size={13} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4, display: 'block' }}>
                    Write to {siteConfig.contactEmail}.
                  </span>
                </div>
              </a>
            </div>

            {/* Footer note */}
            <div style={{ marginTop: '18px', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontFamily: 'var(--font-geist-mono), monospace' }}>
                {siteConfig.logoWord}<span style={{ color: '#F7981E' }}>.</span> appreciates your feedback
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
