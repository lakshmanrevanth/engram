'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { signOut, useSession } from 'next-auth/react';
import { ListFilter, Calendar, Settings, MoreHorizontal, MessageSquare, LogOut, Network, BarChart3 } from 'lucide-react';
import { FeedbackModal } from '@/components/feedback-modal';
import { ThemeToggle } from '@/components/theme-toggle';

const navItems = [
  {
    label: 'Lists',
    href: '/dashboard',
    icon: ListFilter,
  },
  {
    label: 'Daily',
    href: '/daily',
    icon: Calendar,
  },
  {
    label: 'Design',
    href: '/concepts',
    icon: Network,
  },
  {
    label: 'Stats',
    href: '/stats',
    icon: BarChart3,
  },
];
// Settings lives in the "More" sheet so the dock fits on narrow phones.

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const itemLabelStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  fontSize: '10px',
  fontFamily: 'var(--font-geist-sans), sans-serif',
  letterSpacing: '0.02em',
};

const sheetRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '11px 12px',
  borderRadius: 10,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-strong)',
  fontSize: 14,
  textAlign: 'left',
  cursor: 'pointer',
};

export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [moreOpen, setMoreOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetTitleId = useId();
  const settingsActive = pathname === '/settings';

  const closeMore = useCallback((restoreFocus = true) => {
    setMoreOpen(false);
    if (restoreFocus) window.setTimeout(() => moreBtnRef.current?.focus(), 0);
  }, []);

  // Escape closes the sheet, Tab stays inside it, and focus starts on its first item.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMore();
        return;
      }
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const items = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen, closeMore]);

  return (
    <>
      <nav
        data-mobile-nav
        aria-label="Main"
        style={{
          display: 'none', // Hidden on desktop by default, overridden to flex on mobile via @media
          position: 'fixed',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px',
          borderRadius: '24px',
          background: 'var(--mobile-nav-bg)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid var(--mobile-nav-border)',
          boxShadow: 'var(--mobile-nav-shadow)',
          gap: '4px',
          width: 'max-content',
          maxWidth: 'calc(100vw - 32px)',
          boxSizing: 'border-box',
        }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              style={{ textDecoration: 'none', position: 'relative' }}
            >
              <motion.div
                whileTap={{ scale: 0.92 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 18px',
                  borderRadius: '18px',
                  position: 'relative',
                  color: isActive ? 'var(--mobile-nav-active-text)' : 'var(--mobile-nav-inactive-text)',
                  transition: 'color 0.2s ease',
                  gap: '3px',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="dock-active-pill"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '18px',
                      background: 'var(--mobile-nav-active-bg)',
                      border: '1px solid var(--mobile-nav-active-border)',
                      zIndex: 0,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color="currentColor" aria-hidden="true" />
                </div>

                <span style={{ ...itemLabelStyle, fontWeight: isActive ? 500 : 400 }}>{item.label}</span>

                {/* Active Orange Accent Dot */}
                {isActive && (
                  <motion.div
                    layoutId="dock-active-dot"
                    style={{
                      position: 'absolute',
                      bottom: '3px',
                      width: '3px',
                      height: '3px',
                      borderRadius: '50%',
                      background: '#ff6b00',
                      boxShadow: '0 0 6px #ff6b00',
                      zIndex: 1,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}

        {/* More: settings, theme, feedback and sign out */}
        <motion.button
          ref={moreBtnRef}
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={() => (moreOpen ? closeMore() : setMoreOpen(true))}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-label={settingsActive ? 'More (current section: Settings)' : undefined}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 14px',
            borderRadius: '18px',
            background: moreOpen || settingsActive ? 'var(--mobile-nav-active-bg)' : 'transparent',
            border: 'none',
            color: moreOpen || settingsActive ? 'var(--mobile-nav-active-text)' : 'var(--mobile-nav-inactive-text)',
            cursor: 'pointer',
            gap: '3px',
          }}
        >
          <MoreHorizontal size={18} aria-hidden="true" />
          <span style={{ ...itemLabelStyle, fontWeight: 400 }}>More</span>
        </motion.button>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <div data-mobile-more-sheet style={{ position: 'fixed', inset: 0, zIndex: 150 }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => closeMore()}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.5)' }}
            />
            <motion.div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={sheetTitleId}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: 88,
                maxWidth: 420,
                margin: '0 auto',
                background: 'var(--popover)',
                border: '1px solid var(--popover-border)',
                borderRadius: 16,
                padding: 12,
                boxShadow: 'var(--shadow-modal)',
              }}
            >
              <div style={{ padding: '4px 12px 10px' }}>
                <div id={sheetTitleId} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>
                  More
                </div>
                {session?.user && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {session.user.name || session.user.email}
                  </div>
                )}
              </div>

              <div style={{ padding: '4px 12px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 6 }}>Theme</div>
                <ThemeToggle variant="segmented" />
              </div>

              <div style={{ borderTop: '1px solid var(--popover-border)', paddingTop: 6 }}>
                <Link
                  href="/settings"
                  aria-current={settingsActive ? 'page' : undefined}
                  onClick={() => closeMore(false)}
                  style={{
                    ...sheetRowStyle,
                    textDecoration: 'none',
                    fontWeight: settingsActive ? 500 : 400,
                    background: settingsActive ? 'var(--mobile-nav-active-bg)' : 'transparent',
                  }}
                >
                  <Settings size={16} aria-hidden="true" style={{ color: 'var(--text-subtle)' }} />
                  Settings
                </Link>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  style={sheetRowStyle}
                  onClick={() => {
                    closeMore(false);
                    setFeedbackOpen(true);
                  }}
                >
                  <MessageSquare size={16} aria-hidden="true" style={{ color: 'var(--text-subtle)' }} />
                  Feedback
                </button>
                <button
                  type="button"
                  style={{ ...sheetRowStyle, color: 'var(--error)' }}
                  onClick={() => signOut({ callbackUrl: '/' })}
                >
                  <LogOut size={16} aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => {
          setFeedbackOpen(false);
          window.setTimeout(() => moreBtnRef.current?.focus(), 0);
        }}
      />
    </>
  );
}
