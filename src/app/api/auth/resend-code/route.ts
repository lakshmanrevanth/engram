// POST /api/auth/resend-code — resend 6-digit OTP code with 60s cooldown
//
// Always returns the same response (unknown email, already verified, cooldown,
// or sent) so it can't be used to find out which emails have accounts.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { otpToken } from '@/lib/otp-guard';
import { sendVerificationEmail } from '@/lib/mail';
import { authRules, checkRateLimits, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

const GENERIC_RESPONSE = {
  success: true,
  message: 'If this email is waiting to be verified, a new code is on its way.',
};

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const limited = await checkRateLimits(authRules('resend-code', getClientIp(req.headers), normalizedEmail));
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.emailVerified) {
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    // Skip sending if a code went out in the last 60 seconds (10 min expiry).
    const existingToken = await prisma.verificationToken.findFirst({
      where: { identifier: normalizedEmail },
    });

    if (existingToken) {
      const remainingMs = existingToken.expires.getTime() - Date.now();
      const elapsedMs = 10 * 60 * 1000 - remainingMs;
      if (elapsedMs < 60 * 1000 && elapsedMs >= 0) {
        return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
      }
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await prisma.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    });

    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: otpToken(normalizedEmail, code),
        expires,
      },
    });

    const mailResult = await sendVerificationEmail({
      email: normalizedEmail,
      code,
      name: user.name,
    });

    if (!mailResult.success) {
      console.warn('[resend-code] Email send failed:', mailResult.error);
    }

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (e) {
    console.error('[POST /api/auth/resend-code]', e);
    return NextResponse.json(
      { error: 'Failed to resend verification code. Please try again.' },
      { status: 500 }
    );
  }
}
