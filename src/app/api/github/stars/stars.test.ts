import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';

describe('GET /api/github/stars', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_GITHUB_REPO', 'owner/repo');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('returns 404 without calling GitHub when no repo is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_GITHUB_REPO', '');
    global.fetch = vi.fn();

    const res = await GET();
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.stars).toBeNull();
    expect(data.repo).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns stargazers count for the configured repo', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 12 }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ stars: 12, repo: 'owner/repo', isFallback: false });
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe('https://api.github.com/repos/owner/repo');
  });

  it('returns a null count when GitHub API returns non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ stars: null, repo: 'owner/repo', isFallback: true });
  });

  it('returns a null count when GitHub API throws an error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ stars: null, repo: 'owner/repo', isFallback: true });
  });
});
