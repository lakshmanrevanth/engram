// POST /api/auth/forgot-password — send 6-digit OTP code to reset password with 60s cooldown
//
// Always returns the same response (unknown email, OAuth-only account, cooldown,
// or sent) so it can't be used to find out which emails have accounts.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { otpToken } from '@/lib/otp-guard';
import { sendPasswordResetEmail } from '@/lib/mail';
import { authRules, checkRateLimits, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

const GENERIC_RESPONSE = {
  success: true,
  message:
    'If an account with a password exists for this email, a reset code has been sent. If you signed up with Google or GitHub, sign in with that instead.',
};

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const limited = await checkRateLimits(authRules('forgot-password', getClientIp(req.headers), normalizedEmail));
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // No account, or an OAuth-only account with no password: send nothing.
    if (!user || !user.password) {
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    // Check if a reset token was created in the last 60 seconds (10 min expiry = 600s, > 540s remaining means < 60s elapsed)
    const tokenIdentifier = `reset:${normalizedEmail}`;
    const existingToken = await prisma.verificationToken.findFirst({
      where: { identifier: tokenIdentifier },
    });

    if (existingToken) {
      const remainingMs = existingToken.expires.getTime() - Date.now();
      const elapsedMs = 10 * 60 * 1000 - remainingMs;
      if (elapsedMs < 60 * 1000 && elapsedMs >= 0) {
        return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
      }
    }

    // Generate fresh 6-digit numeric OTP
    const code = crypto.randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Clean up old reset tokens for this email and save new one
    await prisma.verificationToken.deleteMany({
      where: { identifier: tokenIdentifier },
    });

    await prisma.verificationToken.create({
      data: {
        identifier: tokenIdentifier,
        token: otpToken(tokenIdentifier, code),
        expires,
      },
    });

    const mailResult = await sendPasswordResetEmail({
      email: normalizedEmail,
      code,
      name: user.name,
    });

    if (!mailResult.success) {
      console.warn('[forgot-password] Email send failed:', mailResult.error);
    }

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (e) {
    console.error('[POST /api/auth/forgot-password]', e);
    return NextResponse.json(
      { error: 'Failed to process password reset request. Please try again.' },
      { status: 500 }
    );
  }
}
