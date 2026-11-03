// Single source of truth for branding. Safe to import from server and client
// code: only NEXT_PUBLIC_ env vars are read here.

const rawUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const url = rawUrl.replace(/\/+$/, '');

function hostOf(u: string): string {
  try {
    return new URL(u).host;
  } catch {
    return 'localhost';
  }
}

/** "owner/repo" when NEXT_PUBLIC_GITHUB_REPO is set to a valid value, else null. */
export function parseRepo(value: string | undefined): string | null {
  const v = (value || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
  return /^[\w.-]+\/[\w.-]+$/.test(v) ? v : null;
}

const githubRepo = parseRepo(process.env.NEXT_PUBLIC_GITHUB_REPO);

export const siteConfig = {
  name: 'Engram',
  logoWord: 'engram',
  tagline: 'Learn it once. Keep it for good.',
  /** The tagline split over two lines, for big headings. */
  taglineLines: ['Learn it once.', 'Keep it for good.'],
  description:
    'Spaced repetition for coding problems and system design. Engram schedules reviews right before you forget, so patterns stick for your interviews.',
  owner: 'Lakshman Revanth Reddy',
  contactEmail: 'revanth3527@gmail.com',
  url,
  host: hostOf(url),
  /** "owner/repo", or null when no public repo is configured. */
  githubRepo,
  githubUrl: githubRepo ? `https://github.com/${githubRepo}` : null,
  license: 'GPL-3.0',
} as const;

/** Default sender for transactional email; EMAIL_FROM still overrides. */
export const defaultEmailFrom = `${siteConfig.name} <noreply@${siteConfig.host}>`;

/** "Engram | Learn it once. Keep it for good." */
export const siteTitle = `${siteConfig.name} | ${siteConfig.tagline}`;

export type SiteConfig = typeof siteConfig;
