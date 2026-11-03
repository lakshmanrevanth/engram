// POST /api/auth/reset-password — verify 6-digit OTP code and update password

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { isOtpLocked, recordOtpFailure, clearOtpFailures, otpToken } from '@/lib/otp-guard';
import { AUTH_LIMITS, checkRateLimits, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const { email, code, newPassword } = await req.json();

    if (!email || !code || !newPassword || typeof email !== 'string' || typeof newPassword !== 'string') {
      return NextResponse.json(
        { error: 'Email, reset code, and new password are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanCode = String(code).trim();

    if (cleanCode.length !== 6) {
      return NextResponse.json(
        { error: 'Reset code must be 6 digits.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const limited = await checkRateLimits([
      { key: `reset-password:ip:${getClientIp(req.headers)}`, ...AUTH_LIMITS.codeCheckPerIp },
    ]);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const tokenIdentifier = `reset:${normalizedEmail}`;

    if (await isOtpLocked(tokenIdentifier)) {
      return NextResponse.json({ error: 'Too many wrong codes. Please wait 10 minutes, then request a new code.' }, { status: 429 });
    }

    // Verify token exists and hasn't expired
    const tokenRecord = await prisma.verificationToken.findFirst({
      where: {
        identifier: tokenIdentifier,
        token: otpToken(tokenIdentifier, cleanCode),
        expires: { gt: new Date() },
      },
    });

    if (!tokenRecord) {
      const remaining = await recordOtpFailure(tokenIdentifier);
      if (remaining === 0) {
        return NextResponse.json({ error: 'Too many wrong codes. Please wait 10 minutes, then request a new code.' }, { status: 429 });
      }
      return NextResponse.json(
        { error: 'Invalid or expired reset code. Please request a new code.' },
        { status: 400 }
      );
    }

    // Check user exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email address.' },
        { status: 404 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and ensure emailVerified is set (since they proved email ownership).
    // passwordChangedAt signs out every existing session.
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        password: hashedPassword,
        emailVerified: user.emailVerified ?? new Date(),
        passwordChangedAt: new Date(),
      },
    });

    // Delete all reset tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: tokenIdentifier },
    });
    await clearOtpFailures(tokenIdentifier);

    return NextResponse.json(
      { success: true, message: 'Password reset successfully! Please sign in with your new password.' },
      { status: 200 }
    );
  } catch (e) {
    console.error('[POST /api/auth/reset-password]', e);
    return NextResponse.json(
      { error: 'Something went wrong while resetting your password.' },
      { status: 500 }
    );
  }
}
