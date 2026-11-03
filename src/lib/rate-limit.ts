// Fixed-window rate limiter stored in the RateLimit table.
//
// Each key (e.g. "signup:ip:1.2.3.4") has a counter and a window end time.
// The first hit in a window creates/resets the row; later hits increment it.
// If the database call fails we let the request through (fail open) and log it,
// so a limiter problem never blocks sign-in completely.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
};

export const MINUTE = 60 * 1000;

/** Count one hit against `key`. Returns ok:false once more than `limit` hits land in the window. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const now = new Date();
    const nextReset = new Date(now.getTime() + windowMs);

    // Start a new window if the old one has ended.
    const reset = await prisma.rateLimit.updateMany({
      where: { key, resetAt: { lte: now } },
      data: { count: 1, resetAt: nextReset },
    });
    if (reset.count > 0) {
      maybeCleanup(now);
      return { ok: true };
    }

    const row = await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt: nextReset },
      update: { count: { increment: 1 } },
    });

    if (row.count > limit) {
      const retryAfterSec = Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000));
      return { ok: false, retryAfterSec };
    }
    return { ok: true };
  } catch (e) {
    console.error('[rate-limit] limiter failed, allowing request:', e);
    return { ok: true };
  }
}

/** Check several rules; returns the first one that is over its limit. */
export async function checkRateLimits(rules: RateLimitRule[]): Promise<RateLimitResult> {
  let worst: RateLimitResult = { ok: true };
  for (const rule of rules) {
    const result = await rateLimit(rule.key, rule.limit, rule.windowMs);
    if (!result.ok && (worst.ok || result.retryAfterSec > worst.retryAfterSec)) {
      worst = result;
    }
  }
  return worst;
}

/** Best-effort client IP from proxy headers. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get('x-real-ip')?.trim();
  return realIp || 'unknown';
}

export function rateLimitMessage(retryAfterSec: number): string {
  if (retryAfterSec < 60) {
    return `Too many attempts. Please try again in ${retryAfterSec} seconds.`;
  }
  const minutes = Math.ceil(retryAfterSec / 60);
  return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

/** Standard 429 response with a friendly message and Retry-After header. */
export function rateLimitResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: rateLimitMessage(retryAfterSec), code: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  );
}

// Delete expired rows now and then so the table stays small.
function maybeCleanup(now: Date) {
  if (Math.random() > 0.01) return;
  prisma.rateLimit
    .deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 24 * 60 * MINUTE) } } })
    .catch((e: unknown) => console.error('[rate-limit] cleanup failed:', e));
}

// Shared limits for the auth routes.
export const AUTH_LIMITS = {
  perIp: { limit: 10, windowMs: 15 * MINUTE },
  perEmail: { limit: 5, windowMs: 15 * MINUTE },
  // Code checks have their own wrong-guess lockout, so allow more per IP.
  codeCheckPerIp: { limit: 20, windowMs: 15 * MINUTE },
  signInPerIp: { limit: 20, windowMs: 15 * MINUTE },
  signInPerEmailIp: { limit: 5, windowMs: 15 * MINUTE },
} as const;

/** Rules for a route keyed by IP and (optionally) email. */
export function authRules(route: string, ip: string, email?: string): RateLimitRule[] {
  const rules: RateLimitRule[] = [{ key: `${route}:ip:${ip}`, ...AUTH_LIMITS.perIp }];
  if (email) rules.push({ key: `${route}:email:${email}`, ...AUTH_LIMITS.perEmail });
  return rules;
}
