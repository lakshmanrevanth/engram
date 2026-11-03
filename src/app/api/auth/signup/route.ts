// POST /api/auth/signup — create a new user with email + password and send verification code
//
// The response is the same whether or not the email is already registered, so
// the endpoint can't be used to find out which emails have accounts.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { otpToken } from '@/lib/otp-guard';
import { sendVerificationEmail } from '@/lib/mail';
import { authRules, checkRateLimits, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

const CHECK_EMAIL_RESPONSE = {
  requiresVerification: true,
  message: 'Check your email for a 6-digit verification code.',
};

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const limited = await checkRateLimits(authRules('signup', getClientIp(req.headers), normalizedEmail));
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    // Hash before the lookup so both paths take about the same time.
    const hashedPassword = await bcrypt.hash(password, 12);

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { accounts: { select: { id: true }, take: 1 } },
    });

    // Already verified (password or OAuth): send nothing, answer the same way.
    // A linked OAuth account counts as verified: older OAuth users have emailVerified null,
    // and overwriting their password here would let a stranger reset it and sign them out.
    if (existing && (existing.emailVerified || (existing.accounts?.length ?? 0) > 0)) {
      return NextResponse.json({ ...CHECK_EMAIL_RESPONSE, email: normalizedEmail }, { status: 201 });
    }

    if (existing) {
      // Account exists but was never verified — update password & name
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: name || existing.name, password: hashedPassword, passwordChangedAt: new Date() },
      });
    } else {
      // Create new unverified user
      await prisma.user.create({
        data: { name, email: normalizedEmail, password: hashedPassword, emailVerified: null },
      });
    }

    // Generate 6-digit numeric OTP
    const code = crypto.randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Clean up any old tokens for this email and save the new one
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
      name,
    });

    if (!mailResult.success) {
      console.warn('[signup] Email send failed, but token was created:', mailResult.error);
    }

    return NextResponse.json({ ...CHECK_EMAIL_RESPONSE, email: normalizedEmail }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/auth/signup]', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
