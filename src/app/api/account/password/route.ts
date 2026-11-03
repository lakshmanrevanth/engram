// POST /api/account/password — change the password, or set one on an OAuth-only account.
// Body: { currentPassword?, newPassword }
// With an existing password, the current one is required. Without one (OAuth-only),
// the user must have signed in within the last few minutes instead.

import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getSignedInAt, json, passwordError, readJson, RECENT_SIGN_IN_MS } from '../shared';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return json({ error: 'Unauthorized' }, 401);
    const userId = session.user.id;

    const body = await readJson(req);
    const invalid = passwordError(body.newPassword);
    if (invalid) return json({ error: invalid }, 400);
    const newPassword = body.newPassword as string;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (!user) return json({ error: 'User not found' }, 404);

    if (user.password) {
      const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      if (!current || !(await bcrypt.compare(current, user.password))) {
        return json({ error: 'Current password is incorrect' }, 400);
      }
      if (await bcrypt.compare(newPassword, user.password)) {
        return json({ error: 'New password must be different from the current one' }, 400);
      }
    } else {
      const signedInAt = await getSignedInAt(req);
      if (!signedInAt || Date.now() - signedInAt > RECENT_SIGN_IN_MS) {
        return json(
          { error: 'For security, sign in again before setting a password.', code: 'REAUTH_REQUIRED' },
          403
        );
      }
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, passwordChangedAt: new Date() },
    });

    return json({ success: true, passwordSet: !user.password });
  } catch (e) {
    console.error('[POST /api/account/password]', e);
    return json({ error: 'Failed to update password' }, 500);
  }
}
