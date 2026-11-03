// User preferences, stored on the User row (see prisma/schema.prisma).
// Use getUserPreferences() on the server whenever behaviour depends on a setting
// (review ladder, daily goal, timezone, reminders).

import { prisma } from '@/lib/prisma';
import { normalizeLadder, type Ladder } from '@/lib/scheduling';
import { isValidTimeZone } from '@/lib/dates';

export type Platform = 'LEETCODE' | 'CODEFORCES' | 'GFG' | 'HACKERRANK' | 'CODECHEF';
export const PLATFORMS: Platform[] = ['LEETCODE', 'CODEFORCES', 'GFG', 'HACKERRANK', 'CODECHEF'];

export type UserPreferences = {
  timezone: string | null;
  dailyGoal: number;
  defaultPlatform: Platform;
  ladderDays: Ladder;
  remindersEnabled: boolean;
  reminderHour: number; // 0-23, in the user's timezone
  goalBasedStreak: boolean; // true: a day counts toward the streak only when the daily goal is met
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  timezone: null,
  dailyGoal: 5,
  defaultPlatform: 'LEETCODE',
  ladderDays: [3, 7, 14, 30],
  remindersEnabled: false,
  reminderHour: 9,
  goalBasedStreak: false,
};

export const PREFERENCE_SELECT = {
  timezone: true,
  dailyGoal: true,
  defaultPlatform: true,
  ladderDays: true,
  remindersEnabled: true,
  reminderHour: true,
  goalBasedStreak: true,
} as const;

type PreferenceRow = {
  timezone: string | null;
  dailyGoal: number;
  defaultPlatform: string;
  ladderDays: number[];
  remindersEnabled: boolean;
  reminderHour: number;
  goalBasedStreak: boolean;
};

export function toPreferences(row: PreferenceRow | null | undefined): UserPreferences {
  if (!row) return DEFAULT_PREFERENCES;
  return {
    timezone: isValidTimeZone(row.timezone) ? row.timezone : null,
    dailyGoal: row.dailyGoal > 0 ? row.dailyGoal : DEFAULT_PREFERENCES.dailyGoal,
    defaultPlatform: (PLATFORMS as string[]).includes(row.defaultPlatform)
      ? (row.defaultPlatform as Platform)
      : DEFAULT_PREFERENCES.defaultPlatform,
    ladderDays: normalizeLadder(row.ladderDays),
    remindersEnabled: row.remindersEnabled,
    reminderHour: row.reminderHour >= 0 && row.reminderHour <= 23 ? row.reminderHour : 9,
    goalBasedStreak: row.goalBasedStreak,
  };
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: PREFERENCE_SELECT });
  return toPreferences(row);
}

/**
 * Validates a partial preferences update from the client.
 * Returns only the valid fields, or an error message.
 */
export function parsePreferencesUpdate(
  body: Record<string, unknown>
): { data: Partial<Omit<UserPreferences, 'ladderDays'> & { ladderDays: number[] }> } | { error: string } {
  const data: Record<string, unknown> = {};
  if ('timezone' in body) {
    if (body.timezone !== null && !isValidTimeZone(String(body.timezone))) return { error: 'Unknown timezone' };
    data.timezone = body.timezone;
  }
  if ('dailyGoal' in body) {
    const n = Number(body.dailyGoal);
    if (!Number.isInteger(n) || n < 1 || n > 200) return { error: 'Daily goal must be between 1 and 200' };
    data.dailyGoal = n;
  }
  if ('defaultPlatform' in body) {
    if (!(PLATFORMS as unknown[]).includes(body.defaultPlatform)) return { error: 'Unknown platform' };
    data.defaultPlatform = body.defaultPlatform;
  }
  if ('ladderDays' in body) {
    const arr = Array.isArray(body.ladderDays) ? body.ladderDays.map(Number) : [];
    const ladder = normalizeLadder(arr);
    if (ladder.join() !== arr.join()) {
      return { error: 'Intervals must be 4 increasing whole numbers of days between 1 and 365' };
    }
    data.ladderDays = [...ladder];
  }
  if ('remindersEnabled' in body) data.remindersEnabled = Boolean(body.remindersEnabled);
  if ('reminderHour' in body) {
    const h = Number(body.reminderHour);
    if (!Number.isInteger(h) || h < 0 || h > 23) return { error: 'Reminder hour must be 0-23' };
    data.reminderHour = h;
  }
  if ('goalBasedStreak' in body) data.goalBasedStreak = Boolean(body.goalBasedStreak);
  return { data };
}
