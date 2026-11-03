// GET    /api/account — sign-in methods for the settings "Account" section
// DELETE /api/account — permanently delete the account (body: { confirmEmail })

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { emailChangePrefix, json, readJson } from './shared';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return json({ error: 'Unauthorized' }, 401);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        emailVerified: true,
        password: true,
        accounts: { select: { provider: true } },
      },
    });
    if (!user) return json({ error: 'User not found' }, 404);

    return json({
      email: user.email,
      emailVerified: !!user.emailVerified,
      hasPassword: !!user.password,
      providers: [...new Set(user.accounts.map((a) => a.provider))],
    });
  } catch (e) {
    console.error('[GET /api/account]', e);
    return json({ error: 'Failed to load account' }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return json({ error: 'Unauthorized' }, 401);
    const userId = session.user.id;

    const body = await readJson(req);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return json({ error: 'User not found' }, 404);

    const typed = typeof body.confirmEmail === 'string' ? body.confirmEmail.trim().toLowerCase() : '';
    if (typed !== user.email.toLowerCase()) {
      return json({ error: 'Type your email address exactly to confirm' }, 400);
    }

    const email = user.email.toLowerCase();
    // StreakLog, UserColumnConfig and VerificationToken have no relation to User, so delete them here.
    // Everything else (problems, revisions, lists, accounts, sessions) cascades from the user row.
    await prisma.$transaction([
      prisma.streakLog.deleteMany({ where: { userId } }),
      prisma.userColumnConfig.deleteMany({ where: { userId } }),
      prisma.verificationToken.deleteMany({
        where: {
          OR: [
            { identifier: { in: [email, `reset:${email}`, `fail:${email}`, `fail:reset:${email}`] } },
            { identifier: { startsWith: emailChangePrefix(userId) } },
            { identifier: { startsWith: `fail:${emailChangePrefix(userId)}` } },
          ],
        },
      }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    return json({ success: true });
  } catch (e) {
    console.error('[DELETE /api/account]', e);
    return json({ error: 'Failed to delete account' }, 500);
  }
}
