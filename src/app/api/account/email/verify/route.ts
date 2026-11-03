// POST /api/account/email/verify — confirm the code sent to the new email and switch to it.
// Body: { newEmail, code }

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { clearOtpFailures, isOtpLocked, recordOtpFailure } from '@/lib/otp-guard';
import { emailChangeIdentifier, json, normalizeEmail, readJson } from '../../shared';

const LOCKED = 'Too many wrong codes. Please wait 10 minutes, then request a new code.';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return json({ error: 'Unauthorized' }, 401);
    const userId = session.user.id;

    const body = await readJson(req);
    const newEmail = normalizeEmail(body.newEmail);
    const code = typeof body.code === 'string' ? body.code.trim() : String(body.code ?? '').trim();
    if (!newEmail) return json({ error: 'Enter a valid email address' }, 400);
    if (!/^\d{6}$/.test(code)) return json({ error: 'The code must be 6 digits' }, 400);

    const identifier = emailChangeIdentifier(userId, newEmail);
    if (await isOtpLocked(identifier)) return json({ error: LOCKED }, 429);

    const record = await prisma.verificationToken.findFirst({
      where: { identifier, token: `ec_${userId}_${code}`, expires: { gt: new Date() } },
    });
    if (!record) {
      const remaining = await recordOtpFailure(identifier);
      if (remaining === 0) return json({ error: LOCKED }, 429);
      return json({ error: 'Invalid or expired code' }, 400);
    }

    const taken = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
    if (taken && taken.id !== userId) {
      return json({ error: 'That email is already used by another account' }, 409);
    }

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { email: newEmail, emailVerified: new Date() },
      });
    } catch (e) {
      // Unique constraint: someone took the address between the check and the update.
      if ((e as { code?: string }).code === 'P2002') {
        return json({ error: 'That email is already used by another account' }, 409);
      }
      throw e;
    }

    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await clearOtpFailures(identifier);

    return json({ success: true, email: newEmail });
  } catch (e) {
    console.error('[POST /api/account/email/verify]', e);
    return json({ error: 'Failed to change email' }, 500);
  }
}
