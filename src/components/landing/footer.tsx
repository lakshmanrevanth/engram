'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { siteConfig } from '@/config/site';

const GITHUB_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.460-1.335-5.460-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.040.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

/** Links shown in the "Stay Connected" column: email always, GitHub only when a repo is configured. */
const SOCIAL_LINKS: { label: string; href: string; external: boolean; icon: React.ReactNode }[] = [
  ...(siteConfig.githubUrl
    ? [{ label: 'GitHub', href: siteConfig.githubUrl, external: true, icon: GITHUB_ICON }]
    : []),
  {
    label: `Email ${siteConfig.name}`,
    href: `mailto:${siteConfig.contactEmail}`,
    external: false,
    icon: <Mail size={16} strokeWidth={1.75} />,
  },
];

export function Footer() {
  return (
    <footer
      style={{
        background: 'var(--bg)',
        borderTop: '1px solid var(--border)',
        paddingTop: '64px',
        paddingBottom: '40px',
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}
    >
      <div
        data-footer-container
        style={{
          maxWidth: 'clamp(1200px, 90vw, 1600px)',
          margin: '0 auto',
          padding: '0 40px',
        }}
      >
        {/* 4-Column Main Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
            gap: '48px 32px',
            marginBottom: '64px',
          }}
          className="footer-grid"
        >
          {/* Col 1: Brand & Tagline */}
          <div>
            <Link
              href="/"
              style={{
                textDecoration: 'none',
                fontFamily: 'var(--font-geist-sans), sans-serif',
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--foreground)',
                letterSpacing: '-0.03em',
                display: 'inline-block',
                marginBottom: '12px',
              }}
            >
              {siteConfig.logoWord}<span style={{ color: '#ff6b00' }}>.</span>
            </Link>
            <p
              style={{
                fontFamily: 'var(--font-geist-sans), sans-serif',
                fontSize: '14px',
                color: 'var(--muted-foreground)',
                lineHeight: 1.6,
                margin: 0,
                maxWidth: '260px',
              }}
            >
              {siteConfig.tagline}
            </p>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-geist-sans), sans-serif',
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--foreground)',
                margin: '0 0 20px 0',
                letterSpacing: '-0.01em',
              }}
            >
              Quick Links
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Home', href: '/' },
                { label: 'Features', href: '/#capabilities' },
                { label: 'About Us', href: '/about' },
                { label: 'Contact Us', href: '/contact' },
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Daily Revision', href: '/daily' },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    style={{
                      fontFamily: 'var(--font-geist-sans), sans-serif',
                      fontSize: '14px',
                      color: 'var(--muted-foreground)',
                      textDecoration: 'none',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Resources */}
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-geist-sans), sans-serif',
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--foreground)',
                margin: '0 0 20px 0',
                letterSpacing: '-0.01em',
              }}
            >
              Resources
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'The Science', href: '/#science' },
                { label: 'How It Works', href: '/#how-it-works' },
                { label: 'FAQ', href: '/#faq' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms and Conditions', href: '/terms' },
                { label: 'Send Feedback', href: '/contact', external: false },
              ].map((item) => (
                <li key={item.label}>
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: 'var(--font-geist-sans), sans-serif',
                        fontSize: '14px',
                        color: 'var(--muted-foreground)',
                        textDecoration: 'none',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      style={{
                        fontFamily: 'var(--font-geist-sans), sans-serif',
                        fontSize: '14px',
                        color: 'var(--muted-foreground)',
                        textDecoration: 'none',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Stay Connect */}
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-geist-sans), sans-serif',
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--foreground)',
                margin: '0 0 20px 0',
                letterSpacing: '-0.01em',
              }}
            >
              Stay Connected
            </h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target={s.external ? '_blank' : undefined}
                  rel={s.external ? 'noopener noreferrer' : undefined}
                  aria-label={s.label}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: 'var(--footer-social-bg)',
                    border: '1px solid var(--footer-social-border)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--footer-social-color)',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--footer-social-hover-bg)';
                    e.currentTarget.style.borderColor = 'var(--footer-social-hover-border)';
                    e.currentTarget.style.color = 'var(--footer-social-hover-color)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--footer-social-bg)';
                    e.currentTarget.style.borderColor = 'var(--footer-social-border)';
                    e.currentTarget.style.color = 'var(--footer-social-color)';
                  }}
                >
                  <span aria-hidden="true" style={{ display: 'inline-flex' }}>{s.icon}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Copyright and Legal Bar */}
        <div
          style={{
            borderTop: '1px solid var(--footer-border)',
            paddingTop: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-geist-sans), sans-serif',
              fontSize: '13px',
              color: 'var(--muted-foreground)',
            }}
          >
            © {new Date().getFullYear()} {siteConfig.name} · {siteConfig.owner}.
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <Link
              href="/privacy"
              style={{
                fontFamily: 'var(--font-geist-sans), sans-serif',
                fontSize: '13px',
                color: 'var(--footer-link)',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--footer-link-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--footer-link)')}
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              style={{
                fontFamily: 'var(--font-geist-sans), sans-serif',
                fontSize: '13px',
                color: 'var(--footer-link)',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--footer-link-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--footer-link)')}
            >
              Terms and Conditions
            </Link>
            <Link
              href="/about"
              style={{
                fontFamily: 'var(--font-geist-sans), sans-serif',
                fontSize: '13px',
                color: 'var(--footer-link)',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--footer-link-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--footer-link)')}
            >
              About Us
            </Link>
            <Link
              href="/contact"
              style={{
                fontFamily: 'var(--font-geist-sans), sans-serif',
                fontSize: '13px',
                color: 'var(--footer-link)',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--footer-link-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--footer-link)')}
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 560px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}
