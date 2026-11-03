// GET /api/github/stars — returns the GitHub star count for the repo set in
// NEXT_PUBLIC_GITHUB_REPO ("owner/repo"). Returns 404 when no repo is configured.
import { parseRepo, siteConfig } from '@/config/site';

export const revalidate = 3600;

const FALLBACK_HEADERS = { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' };

export async function GET() {
  const repo = parseRepo(process.env.NEXT_PUBLIC_GITHUB_REPO);
  if (!repo) {
    return Response.json(
      { stars: null, repo: null, error: 'No GitHub repository configured (set NEXT_PUBLIC_GITHUB_REPO).' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent': `${siteConfig.name}-App`,
      Accept: 'application/vnd.github+json',
    };

    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers,
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return Response.json({ stars: null, repo, isFallback: true }, { headers: FALLBACK_HEADERS });
    }

    const data = await res.json();
    const stars = typeof data.stargazers_count === 'number' ? data.stargazers_count : null;

    return Response.json(
      { stars, repo, isFallback: stars === null },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching GitHub stars:', error);
    return Response.json({ stars: null, repo, isFallback: true }, { headers: FALLBACK_HEADERS });
  }
}
