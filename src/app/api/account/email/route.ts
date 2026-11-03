// POST /api/account/email — send a 6-digit code to a new email address.
// Body: { newEmail }. Confirm with POST /api/account/email/verify.

import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  CODE_TTL_MS,
  emailChangeIdentifier,
  emailChangePrefix,
  json,
  normalizeEmail,
  readJson,
  sendEmailChangeCode,
} from '../shared';

const RESEND_COOLDOWN_MS = 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return json({ error: 'Unauthorized' }, 401);
    const userId = session.user.id;

    const body = await readJson(req);
    const newEmail = normalizeEmail(body.newEmail);
    if (!newEmail) return json({ error: 'Enter a valid email address' }, 400);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return json({ error: 'User not found' }, 404);
    if (user.email.toLowerCase() === newEmail) return json({ error: 'That is already your email' }, 400);

    const taken = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
    if (taken) return json({ error: 'That email is already used by another account' }, 409);

    // One pending change per user; enforce a short cooldown between codes.
    const prefix = emailChangePrefix(userId);
    const existing = await prisma.verificationToken.findFirst({
      where: { identifier: { startsWith: prefix }, expires: { gt: new Date() } },
      orderBy: { expires: 'desc' },
    });
    if (existing) {
      const elapsed = CODE_TTL_MS - (existing.expires.getTime() - Date.now());
      if (elapsed >= 0 && elapsed < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return json({ error: `Please wait ${wait}s before requesting a new code.` }, 429);
      }
    }

    await prisma.verificationToken.deleteMany({ where: { identifier: { startsWith: prefix } } });

    // Wrong-guess failures are NOT cleared here: they live under "fail:<identifier>" and expire
    // after 10 minutes. Clearing them on every new code would allow 5 guesses per 60s cooldown
    // forever (the same rule as signup/reset, whose resend routes don't clear them either).
    const identifier = emailChangeIdentifier(userId, newEmail);

    const code = crypto.randomInt(100000, 1000000).toString();
    await prisma.verificationToken.create({
      data: {
        identifier,
        // Prefix keeps the globally unique token column from clashing with other users' codes.
        token: `ec_${userId}_${code}`,
        expires: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    const sent = await sendEmailChangeCode({ to: newEmail, code });
    if (!sent.success) return json({ error: 'Could not send the code. Please try again later.' }, 502);

    return json({ success: true });
  } catch (e) {
    console.error('[POST /api/account/email]', e);
    return json({ error: 'Failed to start email change' }, 500);
  }
}
