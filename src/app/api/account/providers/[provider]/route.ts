// DELETE /api/account/providers/:provider — unlink a sign-in provider (e.g. "github").
// Refused when it is the only way left to sign in.

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { json } from '../../shared';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return json({ error: 'Unauthorized' }, 401);
    const userId = session.user.id;
    const { provider } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, accounts: { select: { id: true, provider: true } } },
    });
    if (!user) return json({ error: 'User not found' }, 404);

    const target = user.accounts.filter((a) => a.provider === provider);
    if (target.length === 0) return json({ error: 'That provider is not linked' }, 404);

    const othersRemain = user.accounts.some((a) => a.provider !== provider);
    if (!user.password && !othersRemain) {
      return json({ error: 'Set a password or link another provider before removing your only sign-in method' }, 400);
    }

    await prisma.account.deleteMany({ where: { userId, provider } });
    return json({ success: true });
  } catch (e) {
    console.error('[DELETE /api/account/providers]', e);
    return json({ error: 'Failed to unlink provider' }, 500);
  }
}
