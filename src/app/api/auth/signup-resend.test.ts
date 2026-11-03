import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as signupHandler } from './signup/route';
import { POST as resendHandler } from './resend-code/route';
import { prisma } from '@/lib/prisma';
import * as mail from '@/lib/mail';
import { User, VerificationToken } from '@prisma/client';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    verificationToken: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    rateLimit: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      upsert: vi.fn().mockResolvedValue({ key: 'k', count: 1, resetAt: new Date(Date.now() + 60000) }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock('@/lib/mail', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
}));

const post = (url: string, body: unknown) =>
  new NextRequest(url, { method: 'POST', body: JSON.stringify(body) });

const verifiedUser = {
  id: 'u1',
  email: 'user@example.com',
  name: 'User',
  password: 'hash',
  emailVerified: new Date(),
} as unknown as User;

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an unverified user and sends a code', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'new' } as User);
    vi.mocked(prisma.verificationToken.create).mockResolvedValue({} as VerificationToken);

    const res = await signupHandler(post('http://localhost/api/auth/signup', { email: 'New@Example.com', password: 'password123' }));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.requiresVerification).toBe(true);
    expect(json.email).toBe('new@example.com');
    expect(prisma.user.create).toHaveBeenCalled();
    expect(mail.sendVerificationEmail).toHaveBeenCalled();
  });

  it('gives the same response for an already verified email and sends nothing', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(verifiedUser);

    const res = await signupHandler(post('http://localhost/api/auth/signup', { email: 'user@example.com', password: 'password123' }));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.requiresVerification).toBe(true);
    expect(json.id).toBeUndefined();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.verificationToken.create).not.toHaveBeenCalled();
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('does not touch an OAuth account whose emailVerified was never set', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...verifiedUser,
      password: null,
      emailVerified: null,
      accounts: [{ id: 'acc1' }],
    } as unknown as User);

    const res = await signupHandler(post('http://localhost/api/auth/signup', { email: 'user@example.com', password: 'password123' }));
    expect(res.status).toBe(201);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.verificationToken.create).not.toHaveBeenCalled();
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('rejects short passwords', async () => {
    const res = await signupHandler(post('http://localhost/api/auth/signup', { email: 'a@b.c', password: 'short' }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/resend-code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function resend(email: string) {
    const res = await resendHandler(post('http://localhost/api/auth/resend-code', { email }));
    return { status: res.status, json: await res.json() };
  }

  it('returns the same response for unknown, verified and unverified emails', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    const unknown = await resend('nobody@example.com');

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(verifiedUser);
    const verified = await resend('user@example.com');

    expect(prisma.verificationToken.create).not.toHaveBeenCalled();

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ ...verifiedUser, emailVerified: null } as User);
    vi.mocked(prisma.verificationToken.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.verificationToken.create).mockResolvedValueOnce({} as VerificationToken);
    const pending = await resend('user@example.com');

    expect(unknown).toEqual(verified);
    expect(pending).toEqual(verified);
    expect(pending.status).toBe(200);
    expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('does not reveal the cooldown', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ ...verifiedUser, emailVerified: null } as User);
    vi.mocked(prisma.verificationToken.findFirst).mockResolvedValueOnce({
      identifier: 'user@example.com',
      token: '123456',
      expires: new Date(Date.now() + 10 * 60 * 1000 - 5000),
    });
    const res = await resend('user@example.com');
    expect(res.status).toBe(200);
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
