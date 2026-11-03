// Session invalidation after a password change.
//
// Each JWT remembers when it was issued (token.issuedAt). When a user's
// password changes we store passwordChangedAt; any token issued before that is
// rejected by the jwt callback in src/auth.ts. The DB check is cached on the
// token for PASSWORD_CHECK_INTERVAL_MS so it doesn't run on every request.

import type { JWT } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export const PASSWORD_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Call after a logged-in user changes their password. This signs out every
 * session, including the current one, so the caller should sign the user in
 * again with the new password (or send them to /auth/login).
 */
export async function bumpPasswordChangedAt(userId: string): Promise<Date> {
  const now = new Date();
  await prisma.user.update({ where: { id: userId }, data: { passwordChangedAt: now } });
  return now;
}

/**
 * Returns the token (possibly with an updated check time), or null if the
 * session should end because the password changed after it was issued or the
 * user no longer exists.
 */
export async function checkTokenFreshness(token: JWT, now = Date.now()): Promise<JWT | null> {
  const userId = token.id as string | undefined;
  if (!userId) return token;

  // Older tokens from before this check existed: start tracking from now.
  if (typeof token.issuedAt !== 'number') {
    return { ...token, issuedAt: now, pwCheckedAt: now };
  }

  if (typeof token.pwCheckedAt === 'number' && now - token.pwCheckedAt < PASSWORD_CHECK_INTERVAL_MS) {
    return token;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordChangedAt: true },
    });
    if (!user) return null;
    if (user.passwordChangedAt && user.passwordChangedAt.getTime() > token.issuedAt) {
      return null;
    }
    return { ...token, pwCheckedAt: now };
  } catch (e) {
    // Don't sign everyone out because of a DB hiccup; try again next request.
    console.error('[auth] password-change check failed:', e);
    return token;
  }
}
