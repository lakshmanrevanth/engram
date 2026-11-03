'use client';

// Settings "Account" section: sign-in methods, password, email change and account deletion.

import { useCallback, useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import {
  ActionButton,
  Card,
  DangerButton,
  StatusText,
  hintStyle,
  inputStyle,
  labelStyle,
  requestJson,
  useSaveState,
} from './ui';

type AccountInfo = {
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  providers: string[];
};

const PROVIDER_LABELS: Record<string, string> = { google: 'Google', github: 'GitHub' };
const providerLabel = (p: string) => PROVIDER_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1);

const subheading: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text-strong)', marginBottom: 10 };
const block: React.CSSProperties = { paddingTop: 20, marginTop: 20, borderTop: '1px solid var(--settings-card-border)' };

const icon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

export function AccountSection({ onEmailChanged }: { onEmailChanged: (email: string) => void }) {
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setInfo(await requestJson<AccountInfo>('/api/account'));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load account details');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  return (
    <Card title="Account" icon={icon} id="account">
      {loadError ? (
        <div role="alert" style={{ fontSize: 12.5, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {loadError}
          <ActionButton onClick={load}>Retry</ActionButton>
        </div>
      ) : !info ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }} role="status">
          Loading account…
        </div>
      ) : (
        <div style={{ maxWidth: 460 }}>
          <SignInMethods info={info} onChange={load} />
          <PasswordForm info={info} onChange={load} />
          <EmailChange
            info={info}
            onChanged={(email) => {
              onEmailChanged(email);
              void load();
            }}
          />
          <DeleteAccount email={info.email} />
        </div>
      )}
    </Card>
  );
}

function SignInMethods({ info, onChange }: { info: AccountInfo; onChange: () => void }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const save = useSaveState();
  const methodCount = info.providers.length + (info.hasPassword ? 1 : 0);

  const unlink = async (provider: string) => {
    const ok = await save.run(
      () => requestJson(`/api/account/providers/${encodeURIComponent(provider)}`, { method: 'DELETE' }),
      `${providerLabel(provider)} unlinked`
    );
    setConfirming(null);
    if (ok) onChange();
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '9px 12px',
    border: '1px solid var(--input-border)',
    borderRadius: 6,
    background: 'var(--input-bg)',
    fontSize: 13,
    color: 'var(--text-strong)',
  };

  return (
    <div>
      <div style={subheading}>Sign-in methods</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {info.hasPassword && (
          <li style={rowStyle}>
            <span>Email and password</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>{info.email}</span>
          </li>
        )}
        {info.providers.map((p) => (
          <li key={p} style={{ ...rowStyle, flexWrap: 'wrap' }}>
            <span>{providerLabel(p)}</span>
            {confirming === p ? (
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Unlink {providerLabel(p)}?</span>
                <DangerButton onClick={() => unlink(p)} disabled={save.state.status === 'saving'} style={{ padding: '5px 10px' }}>
                  {save.state.status === 'saving' ? 'Unlinking…' : 'Unlink'}
                </DangerButton>
                <ActionButton onClick={() => setConfirming(null)} style={{ padding: '5px 10px' }}>
                  Cancel
                </ActionButton>
              </span>
            ) : (
              <ActionButton
                onClick={() => setConfirming(p)}
                disabled={methodCount <= 1}
                title={methodCount <= 1 ? 'This is your only way to sign in' : undefined}
                aria-label={`Unlink ${providerLabel(p)}`}
                style={{ padding: '5px 10px' }}
              >
                Unlink
              </ActionButton>
            )}
          </li>
        ))}
      </ul>
      {methodCount <= 1 && info.providers.length > 0 && (
        <span style={hintStyle}>Set a password below before unlinking your only sign-in provider.</span>
      )}
      <StatusText state={save.state} />
    </div>
  );
}

function PasswordForm({ info, onChange }: { info: AccountInfo; onChange: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [needsReauth, setNeedsReauth] = useState(false);
  const save = useSaveState();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNeedsReauth(false);
    if (next.length < 8) return save.fail('New password must be at least 8 characters');
    if (next !== confirm) return save.fail('The new passwords do not match');
    if (info.hasPassword && !current) return save.fail('Enter your current password');

    const ok = await save.run(async () => {
      try {
        return await requestJson('/api/account/password', {
          method: 'POST',
          body: JSON.stringify(info.hasPassword ? { currentPassword: current, newPassword: next } : { newPassword: next }),
        });
      } catch (err) {
        if ((err as { code?: string }).code === 'REAUTH_REQUIRED') setNeedsReauth(true);
        throw err;
      }
    }, info.hasPassword ? 'Password changed. Other sessions were signed out.' : 'Password set. You can now sign in with your email.');

    if (ok) {
      // Changing the password ends older sessions, so get a fresh one for this tab.
      const res = await signIn('credentials', { email: info.email, password: next, redirect: false }).catch(() => undefined);
      if (!res || res.error) {
        save.fail('Password saved. You will be asked to sign in again shortly.');
      }
      setCurrent('');
      setNext('');
      setConfirm('');
      onChange();
    }
  };

  return (
    <form onSubmit={submit} style={block} noValidate>
      <div style={subheading}>{info.hasPassword ? 'Change password' : 'Set a password'}</div>
      {!info.hasPassword && (
        <p style={{ ...hintStyle, marginTop: -4, marginBottom: 12 }}>
          You sign in with {info.providers.map(providerLabel).join(' or ') || 'a provider'}. Add a password to also sign in with
          your email. For security you must have signed in within the last 10 minutes.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {info.hasPassword && (
          <div>
            <label htmlFor="current-password" style={labelStyle}>Current password</label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              style={inputStyle}
            />
          </div>
        )}
        <div>
          <label htmlFor="new-password" style={labelStyle}>New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-describedby="new-password-hint"
            style={inputStyle}
          />
          <span id="new-password-hint" style={hintStyle}>At least 8 characters.</span>
        </div>
        <div>
          <label htmlFor="confirm-password" style={labelStyle}>Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <ActionButton type="submit" disabled={save.state.status === 'saving'}>
            {save.state.status === 'saving' ? 'Saving…' : info.hasPassword ? 'Change password' : 'Set password'}
          </ActionButton>
        </div>
      </div>
      <StatusText state={save.state} />
      {needsReauth && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {info.providers.map((p) => (
            <ActionButton key={p} onClick={() => signIn(p, { callbackUrl: '/settings#account' })}>
              Sign in again with {providerLabel(p)}
            </ActionButton>
          ))}
        </div>
      )}
    </form>
  );
}

function EmailChange({ info, onChanged }: { info: AccountInfo; onChanged: (email: string) => void }) {
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const { update: updateSession } = useSession();
  const save = useSaveState();

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return save.fail('Enter a valid email address');
    const ok = await save.run(
      () => requestJson('/api/account/email', { method: 'POST', body: JSON.stringify({ newEmail: email }) }),
      `Code sent to ${email}`
    );
    if (ok) setCodeSentTo(email);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeSentTo) return;
    if (!/^\d{6}$/.test(code.trim())) return save.fail('Enter the 6-digit code');
    const ok = await save.run(
      () =>
        requestJson<{ email: string }>('/api/account/email/verify', {
          method: 'POST',
          body: JSON.stringify({ newEmail: codeSentTo, code: code.trim() }),
        }),
      'Email changed. Use the new address next time you sign in.'
    );
    if (ok) {
      onChanged(ok.email);
      // Refresh the session so it carries the new email (src/auth.ts reloads it on update).
      await updateSession().catch(() => undefined);
      setCodeSentTo(null);
      setNewEmail('');
      setCode('');
    }
  };

  return (
    <div style={block}>
      <div style={subheading}>Change email</div>
      <p style={{ ...hintStyle, marginTop: -4, marginBottom: 12 }}>
        Current: <strong style={{ color: 'var(--text-normal)' }}>{info.email}</strong>. We will send a 6-digit code to the new
        address; your email only changes after you enter it.
      </p>
      {!codeSentTo ? (
        <form onSubmit={sendCode} noValidate style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label htmlFor="new-email" className="sr-only">New email address</label>
          <input
            id="new-email"
            type="email"
            autoComplete="email"
            placeholder="new@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 200, width: 'auto' }}
          />
          <ActionButton type="submit" disabled={save.state.status === 'saving' || !newEmail.trim()}>
            {save.state.status === 'saving' ? 'Sending…' : 'Send code'}
          </ActionButton>
        </form>
      ) : (
        <form onSubmit={verify} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="email-code" style={labelStyle}>Code sent to {codeSentTo}</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              id="email-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              style={{ ...inputStyle, width: 140, fontFamily: 'var(--font-geist-mono), monospace', letterSpacing: '0.2em' }}
            />
            <ActionButton type="submit" disabled={save.state.status === 'saving'}>
              {save.state.status === 'saving' ? 'Checking…' : 'Confirm new email'}
            </ActionButton>
            <ActionButton
              onClick={() => {
                setCodeSentTo(null);
                setCode('');
                save.reset();
              }}
            >
              Cancel
            </ActionButton>
          </div>
        </form>
      )}
      <StatusText state={save.state} />
    </div>
  );
}

function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const save = useSaveState();
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  const remove = async () => {
    const ok = await save.run(
      () => requestJson('/api/account', { method: 'DELETE', body: JSON.stringify({ confirmEmail: typed.trim() }) }),
      'Account deleted'
    );
    if (ok) {
      try {
        localStorage.removeItem('recall_daily_target');
        localStorage.removeItem('recall_default_platform');
      } catch {
        // ignore
      }
      await signOut({ callbackUrl: '/' });
    }
  };

  return (
    <div style={block}>
      <div style={{ ...subheading, color: 'var(--error)' }}>Delete account</div>
      <p style={{ ...hintStyle, marginTop: -4, marginBottom: 12 }}>
        Permanently deletes your account, problems, notes, revision history, lists and streaks. This cannot be undone.
        Export your data first if you want a copy.
      </p>
      {!open ? (
        <DangerButton onClick={() => setOpen(true)}>Delete account…</DangerButton>
      ) : (
        <div
          role="group"
          aria-labelledby="delete-confirm-label"
          style={{ border: '1px solid var(--error-border)', background: 'var(--error-bg)', borderRadius: 8, padding: 14 }}
        >
          <label id="delete-confirm-label" htmlFor="delete-confirm" style={{ ...labelStyle, color: 'var(--text-strong)' }}>
            Type <strong>{email}</strong> to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <DangerButton onClick={remove} disabled={!matches || save.state.status === 'saving'}>
              {save.state.status === 'saving' ? 'Deleting…' : 'Permanently delete my account'}
            </DangerButton>
            <ActionButton
              onClick={() => {
                setOpen(false);
                setTyped('');
                save.reset();
              }}
            >
              Cancel
            </ActionButton>
          </div>
        </div>
      )}
      <StatusText state={save.state} />
    </div>
  );
}
