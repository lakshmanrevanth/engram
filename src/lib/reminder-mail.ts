// Reminder emails ("You have 6 reviews due") and a small shared sender for
// account emails. Without RESEND_API_KEY nothing is sent: in development the
// email is described in the server log, in production it is silently skipped.

import { Resend } from 'resend';
import { defaultEmailFrom, siteConfig } from '@/config/site';

const fromEmail = process.env.EMAIL_FROM || defaultEmailFrom;
let client: Resend | null | undefined;

function getClient(): Resend | null {
  if (client === undefined) {
    const key = process.env.RESEND_API_KEY;
    client = key ? new Resend(key) : null;
  }
  return client;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

type SendResult = { success: boolean; error?: string };

/** Sends one email. `devNote` is printed instead when no provider is configured (dev only). */
export async function sendEmail(params: { to: string; subject: string; html: string; devNote: string }): Promise<SendResult> {
  const resend = getClient();
  if (!resend) {
    if (process.env.NODE_ENV === 'production') return { success: false, error: 'Email is not configured' };
    console.log(`\n[${siteConfig.name.toUpperCase()} MAIL] ${params.devNote} (set RESEND_API_KEY to send real emails)\n`);
    return { success: true };
  }
  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send email' };
  }
}

/** Wraps body HTML in the same dark card layout as the other Engram emails. */
export function emailLayout(title: string, bodyHtml: string, footerHtml = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ededed;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#09090b;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#131315;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:36px 28px;text-align:left;">
        <tr><td style="padding-bottom:24px;"><span style="font-family:monospace;font-size:24px;font-weight:700;color:#ffffff;">${siteConfig.logoWord}<span style="color:#ff6b00;">.</span></span></td></tr>
        <tr><td style="padding-bottom:12px;"><h1 style="margin:0;font-size:20px;font-weight:600;color:#ffffff;">${escapeHtml(title)}</h1></td></tr>
        ${bodyHtml}
        <tr><td style="border-top:1px solid #27272a;padding-top:20px;font-size:12px;color:#52525b;line-height:1.5;">${footerHtml || `${siteConfig.name} • Spaced repetition for coding problems &amp; system design`}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildReminderEmail({ name, dueCount, conceptCount = 0 }: { name?: string | null; dueCount: number; conceptCount?: number }) {
  const cleanName = name ? escapeHtml(name.trim().slice(0, 60)) : '';
  const greeting = cleanName ? `Hi ${cleanName},` : 'Hello,';
  const noun = dueCount === 1 ? 'review' : 'reviews';
  const dailyUrl = `${appUrl()}/daily`;
  const settingsUrl = `${appUrl()}/settings`;
  const subject = `You have ${dueCount} ${noun} due today`;
  const body = `
        <tr><td style="padding-bottom:24px;font-size:14px;line-height:1.5;color:#a1a1aa;">${greeting} you have <strong style="color:#ffffff;">${dueCount} ${noun}</strong> due today${conceptCount > 0 ? `, including ${conceptCount} system design concept${conceptCount === 1 ? '' : 's'}` : ''}. A few minutes now keeps them fresh.</td></tr>
        <tr><td style="padding-bottom:28px;"><a href="${escapeHtml(dailyUrl)}" style="display:inline-block;background:#ffffff;color:#09090b;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">Start today's reviews</a></td></tr>`;
  const footer = `You get this because daily reminders are on. To stop them, turn off reminders in <a href="${escapeHtml(settingsUrl)}" style="color:#a1a1aa;">Settings</a>.`;
  return { subject, html: emailLayout(subject, body, footer) };
}

export async function sendReminderEmail(params: { email: string; name?: string | null; dueCount: number; conceptCount?: number }): Promise<SendResult> {
  const { subject, html } = buildReminderEmail(params);
  return sendEmail({
    to: params.email,
    subject,
    html,
    devNote: `Reminder for ${params.email}: ${params.dueCount} due`,
  });
}
