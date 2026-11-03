// Limits wrong guesses on 6-digit email codes (verify-email and reset-password).
//
// Without a limit, a 6-digit code valid for 10 minutes can be brute-forced.
// Failed attempts are recorded as extra VerificationToken rows under a
// "fail:<identifier>" key, so no schema change is needed. After MAX_ATTEMPTS
// wrong guesses the real code is deleted and the user must request a new one.

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const MAX_OTP_ATTEMPTS = 5;

/**
 * Value stored in VerificationToken.token for a 6-digit code.
 * The token column is unique across ALL users, so storing the raw code made two
 * people with the same pending code collide (the second request failed). Hashing
 * identifier + code avoids that and means raw codes are never stored.
 */
export function otpToken(identifier: string, code: string): string {
  return 'otp_' + crypto.createHash('sha256').update(`${identifier}:${code}`).digest('hex');
}

const failKey = (identifier: string) => `fail:${identifier}`;

/** True if this identifier has already used up its guesses for the current code. */
export async function isOtpLocked(identifier: string): Promise<boolean> {
  const failures = await prisma.verificationToken.count({
    where: { identifier: failKey(identifier), expires: { gt: new Date() } },
  });
  return failures >= MAX_OTP_ATTEMPTS;
}

/**
 * Record one wrong guess. Returns how many guesses remain.
 * When none remain, the real code is deleted so it can no longer be guessed.
 */
export async function recordOtpFailure(identifier: string): Promise<number> {
  await prisma.verificationToken.create({
    data: {
      identifier: failKey(identifier),
      token: `fail_${crypto.randomUUID()}`,
      expires: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  const failures = await prisma.verificationToken.count({
    where: { identifier: failKey(identifier), expires: { gt: new Date() } },
  });
  const remaining = Math.max(0, MAX_OTP_ATTEMPTS - failures);
  if (remaining === 0) {
    await prisma.verificationToken.deleteMany({ where: { identifier } });
  }
  return remaining;
}

/** Clear the failure counter (after success, or when a new code is issued). */
export async function clearOtpFailures(identifier: string): Promise<void> {
  await prisma.verificationToken.deleteMany({ where: { identifier: failKey(identifier) } });
}
