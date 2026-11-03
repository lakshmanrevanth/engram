/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { GET as getAccount, DELETE as deleteAccount } from './route';
import { POST as changePassword } from './password/route';
import { POST as requestEmailChange } from './email/route';
import { POST as verifyEmailChange } from './email/verify/route';
import { DELETE as unlinkProvider } from './providers/[provider]/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getSignedInAt, sendEmailChangeCode } from './shared';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

vi.mock('./shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./shared')>();
  return {
    ...actual,
    getSignedInAt: vi.fn(),
    sendEmailChangeCode: vi.fn().mockResolvedValue({ success: true }),
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    account: { deleteMany: vi.fn() },
    streakLog: { deleteMany: vi.fn() },
    userColumnConfig: { deleteMany: vi.fn() },
    verificationToken: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

const post = (url: string, body: unknown, method = 'POST') =>
  new NextRequest(`http://localhost${url}`, { method, body: JSON.stringify(body) });

describe('/api/account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
    vi.mocked(prisma.verificationToken.count).mockResolvedValue(0 as any);
  });

  it('requires a session', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    expect((await getAccount()).status).toBe(401);
    expect((await changePassword(post('/api/account/password', {}))).status).toBe(401);
    expect((await deleteAccount(post('/api/account', {}, 'DELETE'))).status).toBe(401);
  });

  it('GET lists sign-in methods', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: 'a@x.com',
      emailVerified: new Date(),
      password: 'hash',
      accounts: [{ provider: 'github' }, { provider: 'google' }],
    } as any);
    const json = await (await getAccount()).json();
    expect(json).toEqual({ email: 'a@x.com', emailVerified: true, hasPassword: true, providers: ['github', 'google'] });
  });

  describe('password', () => {
    it('rejects a short new password', async () => {
      const res = await changePassword(post('/api/account/password', { newPassword: 'short' }));
      expect(res.status).toBe(400);
    });

    it('requires the correct current password', async () => {
      const hash = await bcrypt.hash('oldpassword', 4);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ password: hash } as any);
      const res = await changePassword(
        post('/api/account/password', { currentPassword: 'wrongpass', newPassword: 'newpassword' })
      );
      expect(res.status).toBe(400);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('changes the password and sets passwordChangedAt', async () => {
      const hash = await bcrypt.hash('oldpassword', 4);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ password: hash } as any);
      const res = await changePassword(
        post('/api/account/password', { currentPassword: 'oldpassword', newPassword: 'newpassword' })
      );
      expect(res.status).toBe(200);
      const data = vi.mocked(prisma.user.update).mock.calls[0][0].data as any;
      expect(await bcrypt.compare('newpassword', data.password)).toBe(true);
      expect(data.passwordChangedAt).toBeInstanceOf(Date);
    });

    it('OAuth-only accounts need a recent sign-in to set a password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ password: null } as any);
      vi.mocked(getSignedInAt).mockResolvedValue(Date.now() - 60 * 60 * 1000);
      let res = await changePassword(post('/api/account/password', { newPassword: 'newpassword' }));
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('REAUTH_REQUIRED');

      vi.mocked(getSignedInAt).mockResolvedValue(Date.now() - 60 * 1000);
      res = await changePassword(post('/api/account/password', { newPassword: 'newpassword' }));
      expect(res.status).toBe(200);
    });
  });

  describe('email change', () => {
    it('rejects an email used by another account', async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({ email: 'a@x.com' } as any)
        .mockResolvedValueOnce({ id: 'u2' } as any);
      const res = await requestEmailChange(post('/api/account/email', { newEmail: 'B@x.com' }));
      expect(res.status).toBe(409);
      expect(sendEmailChangeCode).not.toHaveBeenCalled();
    });

    it('sends a code to the new address', async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({ email: 'a@x.com' } as any)
        .mockResolvedValueOnce(null);
      vi.mocked(prisma.verificationToken.findFirst).mockResolvedValue(null);
      const res = await requestEmailChange(post('/api/account/email', { newEmail: 'B@x.com' }));
      expect(res.status).toBe(200);
      const created = vi.mocked(prisma.verificationToken.create).mock.calls[0][0].data;
      expect(created.identifier).toBe('email-change:u1:b@x.com');
      expect(vi.mocked(sendEmailChangeCode).mock.calls[0][0].to).toBe('b@x.com');
      // A new code must not reset the wrong-guess counter, or the lockout can be bypassed.
      const deletes = vi.mocked(prisma.verificationToken.deleteMany).mock.calls.map((c) => JSON.stringify(c[0]));
      expect(deletes.some((d) => d.includes('fail:'))).toBe(false);
    });

    it('records a failure for a wrong code', async () => {
      vi.mocked(prisma.verificationToken.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.verificationToken.count).mockResolvedValue(1 as any);
      const res = await verifyEmailChange(post('/api/account/email/verify', { newEmail: 'b@x.com', code: '123456' }));
      expect(res.status).toBe(400);
      expect(prisma.verificationToken.create).toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('is locked after too many wrong codes', async () => {
      vi.mocked(prisma.verificationToken.count).mockResolvedValue(5 as any);
      const res = await verifyEmailChange(post('/api/account/email/verify', { newEmail: 'b@x.com', code: '123456' }));
      expect(res.status).toBe(429);
    });

    it('switches the email with a valid code', async () => {
      vi.mocked(prisma.verificationToken.findFirst).mockResolvedValue({ identifier: 'x' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      const res = await verifyEmailChange(post('/api/account/email/verify', { newEmail: 'b@x.com', code: '123456' }));
      expect(res.status).toBe(200);
      const data = vi.mocked(prisma.user.update).mock.calls[0][0].data as any;
      expect(data.email).toBe('b@x.com');
      expect(data.emailVerified).toBeInstanceOf(Date);
    });
  });

  describe('unlink provider', () => {
    const ctx = (provider: string) => ({ params: Promise.resolve({ provider }) });

    it('refuses to remove the only sign-in method', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        password: null,
        accounts: [{ id: '1', provider: 'github' }],
      } as any);
      const res = await unlinkProvider(post('/api/account/providers/github', {}, 'DELETE'), ctx('github'));
      expect(res.status).toBe(400);
      expect(prisma.account.deleteMany).not.toHaveBeenCalled();
    });

    it('unlinks when another method remains', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        password: null,
        accounts: [{ id: '1', provider: 'github' }, { id: '2', provider: 'google' }],
      } as any);
      const res = await unlinkProvider(post('/api/account/providers/github', {}, 'DELETE'), ctx('github'));
      expect(res.status).toBe(200);
      expect(prisma.account.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', provider: 'github' } });
    });
  });

  describe('delete account', () => {
    it('requires the typed email to match', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: 'a@x.com' } as any);
      const res = await deleteAccount(post('/api/account', { confirmEmail: 'nope@x.com' }, 'DELETE'));
      expect(res.status).toBe(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('deletes the user and unrelated rows', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: 'a@x.com' } as any);
      const res = await deleteAccount(post('/api/account', { confirmEmail: ' A@x.com ' }, 'DELETE'));
      expect(res.status).toBe(200);
      expect(prisma.streakLog.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(prisma.userColumnConfig.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });
  });
});
