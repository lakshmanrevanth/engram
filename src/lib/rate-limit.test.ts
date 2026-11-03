import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { rateLimit, checkRateLimits, getClientIp, rateLimitResponse, rateLimitMessage } from './rate-limit';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateLimit: {
      updateMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

const future = (ms: number) => new Date(Date.now() + ms);

describe('rateLimit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.rateLimit.deleteMany).mockResolvedValue({ count: 0 });
  });

  it('starts a new window when the old one has ended', async () => {
    vi.mocked(prisma.rateLimit.updateMany).mockResolvedValue({ count: 1 });
    const res = await rateLimit('k', 3, 60_000);
    expect(res.ok).toBe(true);
    expect(prisma.rateLimit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'k', resetAt: { lte: expect.any(Date) } },
        data: { count: 1, resetAt: expect.any(Date) },
      })
    );
    expect(prisma.rateLimit.upsert).not.toHaveBeenCalled();
  });

  it('allows hits up to the limit', async () => {
    vi.mocked(prisma.rateLimit.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.rateLimit.upsert).mockResolvedValue({ key: 'k', count: 3, resetAt: future(30_000) });
    expect((await rateLimit('k', 3, 60_000)).ok).toBe(true);
  });

  it('blocks once over the limit and reports seconds until reset', async () => {
    vi.mocked(prisma.rateLimit.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.rateLimit.upsert).mockResolvedValue({ key: 'k', count: 4, resetAt: future(30_000) });
    const res = await rateLimit('k', 3, 60_000);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.retryAfterSec).toBeGreaterThan(25);
      expect(res.retryAfterSec).toBeLessThanOrEqual(30);
    }
  });

  it('fails open when the database errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(prisma.rateLimit.updateMany).mockRejectedValue(new Error('db down'));
    expect((await rateLimit('k', 1, 60_000)).ok).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('checkRateLimits', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.rateLimit.updateMany).mockResolvedValue({ count: 0 });
  });

  it('returns the longest wait among blocked rules', async () => {
    vi.mocked(prisma.rateLimit.upsert)
      .mockResolvedValueOnce({ key: 'a', count: 99, resetAt: future(10_000) })
      .mockResolvedValueOnce({ key: 'b', count: 99, resetAt: future(100_000) });
    const res = await checkRateLimits([
      { key: 'a', limit: 1, windowMs: 60_000 },
      { key: 'b', limit: 1, windowMs: 60_000 },
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.retryAfterSec).toBeGreaterThan(90);
  });
});

describe('getClientIp', () => {
  it('uses the first x-forwarded-for entry', () => {
    expect(getClientIp(new Headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('1.1.1.1');
  });
  it('falls back to x-real-ip, then unknown', () => {
    expect(getClientIp(new Headers({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3');
    expect(getClientIp(new Headers())).toBe('unknown');
  });
});

describe('rateLimitResponse', () => {
  it('returns 429 with Retry-After and a friendly message', async () => {
    const res = rateLimitResponse(120);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('120');
    const json = await res.json();
    expect(json.error).toBe('Too many attempts. Please try again in 2 minutes.');
    expect(json.code).toBe('rate_limited');
  });
  it('uses seconds for short waits', () => {
    expect(rateLimitMessage(30)).toContain('30 seconds');
  });
});
