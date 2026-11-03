import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { checkTokenFreshness, bumpPasswordChangedAt, PASSWORD_CHECK_INTERVAL_MS } from './auth-session';
import type { User } from '@prisma/client';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const NOW = 1_800_000_000_000;

describe('checkTokenFreshness', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('leaves tokens without a user id alone', async () => {
    const token = { email: 'a@b.c' };
    expect(await checkTokenFreshness(token, NOW)).toBe(token);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('starts tracking older tokens that have no issuedAt', async () => {
    const res = await checkTokenFreshness({ id: 'u1' }, NOW);
    expect(res).toMatchObject({ id: 'u1', issuedAt: NOW, pwCheckedAt: NOW });
  });

  it('skips the DB check inside the cache interval', async () => {
    const token = { id: 'u1', issuedAt: NOW - 1000, pwCheckedAt: NOW - 1000 };
    expect(await checkTokenFreshness(token, NOW)).toBe(token);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('ends the session when the password changed after the token was issued', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ passwordChangedAt: new Date(NOW - 1000) } as unknown as User);
    const token = { id: 'u1', issuedAt: NOW - 60_000, pwCheckedAt: NOW - PASSWORD_CHECK_INTERVAL_MS - 1 };
    expect(await checkTokenFreshness(token, NOW)).toBeNull();
  });

  it('keeps the session when the password changed before sign-in', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ passwordChangedAt: new Date(NOW - 120_000) } as unknown as User);
    const token = { id: 'u1', issuedAt: NOW - 60_000, pwCheckedAt: NOW - PASSWORD_CHECK_INTERVAL_MS - 1 };
    expect(await checkTokenFreshness(token, NOW)).toMatchObject({ id: 'u1', pwCheckedAt: NOW });
  });

  it('ends the session when the user no longer exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    expect(await checkTokenFreshness({ id: 'u1', issuedAt: NOW - 1 }, NOW)).toBeNull();
  });

  it('keeps the session if the DB check fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('db down'));
    const token = { id: 'u1', issuedAt: NOW - 1 };
    expect(await checkTokenFreshness(token, NOW)).toBe(token);
    spy.mockRestore();
  });
});

describe('bumpPasswordChangedAt', () => {
  it('stores the change time on the user', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({} as User);
    const at = await bumpPasswordChangedAt('u1');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { passwordChangedAt: at } });
  });
});
