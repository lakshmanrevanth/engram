// GET   /api/settings — the user's profile and preferences
// PATCH /api/settings — update the display name and/or preferences

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserPreferences, parsePreferencesUpdate, PREFERENCE_SELECT, toPreferences } from '@/lib/preferences';

const NAME_MAX_LENGTH = 60;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    const preferences = await getUserPreferences(userId);
    return Response.json({ user, preferences });
  } catch (e) {
    console.error('[GET /api/settings]', e);
    return Response.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if ('name' in input) {
      if (typeof input.name !== 'string') return Response.json({ error: 'Name must be text' }, { status: 400 });
      const name = input.name.trim();
      if (!name) return Response.json({ error: 'Name cannot be empty' }, { status: 400 });
      if (name.length > NAME_MAX_LENGTH) {
        return Response.json({ error: `Name must be at most ${NAME_MAX_LENGTH} characters` }, { status: 400 });
      }
      data.name = name;
    }

    const parsed = parsePreferencesUpdate(input);
    if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 });
    Object.assign(data, parsed.data);

    if (Object.keys(data).length === 0) {
      return Response.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, ...PREFERENCE_SELECT },
    });

    const { id, name, email, ...prefRow } = updated;
    return Response.json({
      success: true,
      user: { id, name, email },
      preferences: toPreferences(prefRow),
    });
  } catch (e) {
    console.error('[PATCH /api/settings]', e);
    return Response.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
