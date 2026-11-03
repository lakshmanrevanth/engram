// Helpers shared by the /api/account routes.

import { siteConfig } from '@/config/site';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { escapeHtml, emailLayout, sendEmail } from '@/lib/reminder-mail';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const RECENT_SIGN_IN_MS = 10 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

export function passwordError(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) return 'Password is too long';
  return null;
}

export const emailChangeIdentifier = (userId: string, newEmail: string) => `email-change:${userId}:${newEmail}`;
export const emailChangePrefix = (userId: string) => `email-change:${userId}:`;

/**
 * When the user last signed in, from the session JWT (ms).
 * Uses `signedInAt`, which src/auth.ts sets only at a real sign-in. `issuedAt` is not used
 * because older sessions get it backfilled, and `iat` changes whenever Auth.js re-issues the token.
 */
export async function getSignedInAt(req: NextRequest): Promise<number | null> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const secureCookie = req.nextUrl.protocol === 'https:';
  const token = await getToken({ req, secret, secureCookie });
  const value = token?.signedInAt;
  return typeof value === 'number' ? value : null;
}

export async function sendEmailChangeCode(params: { to: string; code: string }) {
  const body = `
        <tr><td style="padding-bottom:24px;font-size:14px;line-height:1.5;color:#a1a1aa;">Enter this code in ${siteConfig.name} settings to confirm <strong style="color:#ffffff;">${escapeHtml(params.to)}</strong> as your new sign-in email.</td></tr>
        <tr><td style="padding-bottom:24px;" align="center"><div style="background-color:#1a1a1d;border:1px solid #2a2a2e;border-radius:10px;padding:18px 24px;text-align:center;"><span style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#ffffff;">${params.code}</span></div></td></tr>
        <tr><td style="padding-bottom:28px;font-size:13px;color:#71717a;line-height:1.5;">This code expires in 10 minutes. If you did not ask to change your email, ignore this message.</td></tr>`;
  return sendEmail({
    to: params.to,
    subject: `${params.code} is your ${siteConfig.name} email change code`,
    html: emailLayout('Confirm your new email', body),
    devNote: `Email change code for ${params.to}: ${params.code}`,
  });
}
