'use client';

// Mobile layout for the auth flow. All logic lives in useAuthFlow; this file
// only draws it. The login page renders this and the desktop layout together
// and CSS shows the right one.

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';
import { OtpInput } from '@/components/auth/otp-input';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuthFlow, onSubmit, type AuthFlow } from '@/components/auth/use-auth-flow';
import { siteConfig } from '@/config/site';

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: '2px solid var(--text-dim)',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }}
    />
  );
}

function MobileInput({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  name,
  required,
  minLength,
  rightLabelAction,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  name?: string;
  required?: boolean;
  minLength?: number;
  rightLabelAction?: React.ReactNode;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <label htmlFor={id} style={{ display: 'block', fontSize: '13px', color: 'var(--text-dim)' }}>{label}</label>
        {rightLabelAction}
      </div>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          name={name}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          spellCheck={false}
          autoCapitalize={type === 'email' || isPassword ? 'none' : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            background: 'var(--auth-input-bg)',
            border: `1px solid ${focused ? 'var(--auth-input-focus)' : 'var(--auth-input-border)'}`,
            boxShadow: focused ? '0 0 0 3px var(--otp-focus-ring)' : 'none',
            borderRadius: '8px',
            color: 'var(--text-white)',
            fontSize: '16px',
            padding: isPassword ? '12px 42px 12px 14px' : '12px 14px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: 'var(--text-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-controls={id}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}

function SubmitButton({ enabled, loading, children, style }: { enabled: boolean; loading: boolean; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button
      type="submit"
      disabled={!enabled}
      aria-busy={loading || undefined}
      style={{
        width: '100%',
        height: '44px',
        background: enabled ? 'var(--primary)' : 'var(--auth-btn-disabled-bg)',
        color: enabled ? 'var(--primary-foreground)' : 'var(--auth-btn-disabled-color)',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: enabled ? 'pointer' : 'not-allowed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        ...style,
      }}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

const noticeBase: React.CSSProperties = {
  borderRadius: '8px',
  padding: '10px 14px',
  fontSize: '13px',
  marginBottom: '16px',
  lineHeight: 1.4,
};

function Notices({ error, success, gap = '16px' }: { error?: string; success?: string; gap?: string }) {
  return (
    <>
      <div aria-live="polite" aria-atomic="true">
        {success && (
          <div style={{ ...noticeBase, marginBottom: gap, background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)' }}>
            {success}
          </div>
        )}
      </div>
      {error && (
        <div role="alert" style={{ ...noticeBase, marginBottom: gap, background: 'var(--error-bg)', border: '1px solid var(--error-border)', color: 'var(--error)' }}>
          {error}
        </div>
      )}
    </>
  );
}

const backStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-dim)',
  fontSize: '13px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: 0,
  marginBottom: '16px',
};

const headingStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 600,
  color: 'var(--text-white)',
  letterSpacing: '-0.02em',
  margin: '0 0 6px 0',
};

const descStyle: React.CSSProperties = { fontSize: '13px', color: 'var(--text-dim)', margin: '0 0 16px 0', lineHeight: 1.4 };

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-white)',
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: 0,
};

const screenMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2 },
};

const oauthStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%',
  height: '44px',
  background: 'transparent',
  border: '1px solid var(--auth-oauth-border)',
  borderRadius: '8px',
  color: 'var(--text-white)',
  fontSize: '14px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
});

function VerifyScreen({ flow }: { flow: AuthFlow }) {
  return (
    <motion.div key="mobile-verify" {...screenMotion}>
      <button type="button" onClick={flow.backFromVerify} style={backStyle}>← Back</button>
      <h2 style={headingStyle}>Verify your email</h2>
      <p id="m-verify-desc" style={descStyle}>
        Code sent to <strong style={{ color: 'var(--text-white)' }}>{flow.verifyEmail}</strong>
      </p>

      <Notices error={flow.verifyError} success={flow.resendSuccess} />

      <form onSubmit={onSubmit(() => flow.handleVerifyCode())} noValidate>
        <OtpInput
          idPrefix="m-verify-otp"
          labelledBy="m-verify-desc"
          value={flow.otp}
          onChange={flow.setOtp}
          onComplete={(code) => flow.handleVerifyCode(code)}
          disabled={flow.verifyLoading}
          error={!!flow.verifyError}
          autoFocus
        />
        <SubmitButton
          enabled={flow.otp.length === 6 && !flow.verifyLoading}
          loading={flow.verifyLoading}
          style={{ marginTop: '8px', marginBottom: '16px' }}
        >
          Verify & Continue →
        </SubmitButton>
      </form>

      <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
        {flow.resendCooldown > 0 ? (
          <span>Resend in <strong style={{ color: 'var(--text-normal)' }}>{flow.resendCooldown}s</strong></span>
        ) : (
          <span>
            Didn&apos;t get the code?{' '}
            <button type="button" onClick={flow.handleResendCode} disabled={flow.resendLoading} style={{ ...linkStyle, fontSize: '13px' }}>
              {flow.resendLoading ? 'Sending...' : 'Resend'}
            </button>
          </span>
        )}
      </div>

      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-subtle)' }}>
        <button type="button" onClick={() => flow.setMode('form')} style={{ ...linkStyle, color: 'var(--text-dim)', fontSize: '12px' }}>
          Change email address
        </button>
        {' · '}
        <button type="button" onClick={() => flow.goToSignIn(flow.verifyEmail)} style={{ ...linkStyle, color: 'var(--text-dim)', fontSize: '12px' }}>
          Already verified? Sign in
        </button>
      </div>
    </motion.div>
  );
}

function ForgotScreen({ flow }: { flow: AuthFlow }) {
  const enabled = !!flow.forgotEmail.trim() && !flow.forgotLoading;
  return (
    <motion.div key="mobile-forgot" {...screenMotion}>
      <button type="button" onClick={flow.backFromForgot} style={backStyle}>← Back to sign in</button>
      <h2 style={headingStyle}>Reset your password</h2>
      <p style={descStyle}>Enter your email and we&apos;ll send you a 6-digit code to reset your password.</p>

      <Notices error={flow.forgotError} />

      <form onSubmit={onSubmit(flow.handleRequestPasswordReset)} noValidate>
        <MobileInput
          id="m-forgot-email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={flow.forgotEmail}
          onChange={flow.setForgotEmail}
          placeholder="you@example.com"
        />
        <SubmitButton enabled={enabled} loading={flow.forgotLoading} style={{ marginTop: '8px', marginBottom: '16px' }}>
          Send reset code →
        </SubmitButton>
      </form>

      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
        Remembered your password?{' '}
        <button type="button" onClick={() => flow.goToSignIn()} style={{ ...linkStyle, fontSize: '12px' }}>
          Sign in
        </button>
      </div>
    </motion.div>
  );
}

function ResetScreen({ flow }: { flow: AuthFlow }) {
  const enabled =
    flow.resetOtp.length === 6 && flow.resetNewPassword.length >= 8 && !!flow.resetConfirmPassword && !flow.resetLoading;
  return (
    <motion.div key="mobile-reset" {...screenMotion}>
      <button type="button" onClick={flow.backFromReset} style={backStyle}>← Change email</button>
      <h2 style={headingStyle}>Set new password</h2>
      <p style={descStyle}>
        Code sent to <strong style={{ color: 'var(--text-white)' }}>{flow.forgotEmail}</strong>
      </p>

      <Notices error={flow.resetError} success={flow.forgotSuccess} />

      <form onSubmit={onSubmit(flow.handleResetPassword)} noValidate>
        <input type="email" name="email" autoComplete="username" value={flow.forgotEmail} readOnly hidden />
        <div style={{ marginBottom: '16px' }}>
          <div id="m-reset-otp-label" style={{ display: 'block', fontSize: '13px', color: 'var(--text-dim)', marginBottom: '8px' }}>
            6-digit reset code
          </div>
          <OtpInput
            idPrefix="m-reset-otp"
            labelledBy="m-reset-otp-label"
            value={flow.resetOtp}
            onChange={flow.setResetOtp}
            disabled={flow.resetLoading}
            error={!!flow.resetError}
            autoFocus
          />
        </div>

        <MobileInput
          id="m-reset-new"
          name="new-password"
          label="New password (min 8 chars)"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={flow.resetNewPassword}
          onChange={flow.setResetNewPassword}
          placeholder="••••••••"
        />
        <MobileInput
          id="m-reset-confirm"
          name="confirm-password"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={flow.resetConfirmPassword}
          onChange={flow.setResetConfirmPassword}
          placeholder="••••••••"
        />

        <SubmitButton enabled={enabled} loading={flow.resetLoading} style={{ marginTop: '8px', marginBottom: '16px' }}>
          Reset password →
        </SubmitButton>
      </form>

      <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
        {flow.forgotCooldown > 0 ? (
          <span>Resend in <strong style={{ color: 'var(--text-normal)' }}>{flow.forgotCooldown}s</strong></span>
        ) : (
          <span>
            Didn&apos;t get the code?{' '}
            <button type="button" onClick={flow.handleResendResetCode} disabled={flow.forgotLoading} style={{ ...linkStyle, fontSize: '13px' }}>
              {flow.forgotLoading ? 'Sending...' : 'Resend'}
            </button>
          </span>
        )}
      </div>
    </motion.div>
  );
}

function TabButton({ flow, value, label }: { flow: AuthFlow; value: 'signin' | 'signup'; label: string }) {
  const active = flow.tab === value;
  return (
    <button
      type="button"
      role="tab"
      id={`m-tab-${value}`}
      aria-selected={active}
      aria-controls="m-panel"
      onClick={() => flow.setTab(value)}
      disabled={flow.isAnyLoading}
      style={{
        flex: 1,
        background: 'none',
        border: 'none',
        cursor: flow.isAnyLoading ? 'not-allowed' : 'pointer',
        fontSize: '15px',
        fontWeight: 500,
        color: active ? 'var(--text-white)' : 'var(--text-muted)',
        paddingBottom: '10px',
        position: 'relative',
      }}
    >
      {label}
      {active && (
        <motion.div
          layoutId="activeMobileTab"
          style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--text-white)', borderRadius: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </button>
  );
}

function FormScreen({ flow }: { flow: AuthFlow }) {
  const currentError = flow.tab === 'signin' ? flow.siError : flow.suError;
  const enabled = !flow.isAnyLoading;

  return (
    <div>
      <div role="tablist" aria-label="Sign in or sign up" style={{ display: 'flex', marginBottom: '24px', borderBottom: '1px solid var(--sidebar-border)', position: 'relative' }}>
        <TabButton flow={flow} value="signin" label="Sign in" />
        <TabButton flow={flow} value="signup" label="Sign up" />
      </div>

      <div id="m-panel" role="tabpanel" aria-labelledby={`m-tab-${flow.tab}`}>
        <Notices error={currentError} success={flow.forgotSuccess} gap="20px" />

        <AnimatePresence mode="wait">
          {flow.tab === 'signin' ? (
            <motion.div key="mobile-signin" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
              <form onSubmit={onSubmit(flow.handleSignIn)} noValidate>
                <MobileInput
                  id="m-signin-email"
                  name="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                  value={flow.siEmail}
                  onChange={flow.setSiEmail}
                  placeholder="you@example.com"
                />
                <MobileInput
                  id="m-signin-password"
                  name="password"
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={flow.siPassword}
                  onChange={flow.setSiPassword}
                  placeholder="••••••••"
                  rightLabelAction={
                    <button
                      type="button"
                      onClick={flow.openForgot}
                      style={{ ...linkStyle, color: 'var(--text-normal)', fontSize: '12px' }}
                    >
                      Forgot password?
                    </button>
                  }
                />
                <SubmitButton enabled={enabled} loading={flow.siLoading} style={{ marginBottom: '10px' }}>
                  Sign in →
                </SubmitButton>
              </form>

              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <button type="button" onClick={flow.handleNeedVerify} style={{ ...linkStyle, color: 'var(--text-muted)', fontSize: '12px' }}>
                  Need to verify your signup email? Enter code →
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="mobile-signup" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
              <form onSubmit={onSubmit(flow.handleSignUp)} noValidate>
                <MobileInput
                  id="m-signup-name"
                  name="name"
                  label="Full Name"
                  type="text"
                  autoComplete="name"
                  value={flow.suName}
                  onChange={flow.setSuName}
                  placeholder="Alex Rivers"
                />
                <MobileInput
                  id="m-signup-email"
                  name="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                  value={flow.suEmail}
                  onChange={flow.setSuEmail}
                  placeholder="you@example.com"
                />
                <MobileInput
                  id="m-signup-password"
                  name="new-password"
                  label="Password (min 8 characters)"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={flow.suPassword}
                  onChange={flow.setSuPassword}
                  placeholder="••••••••"
                />
                <SubmitButton enabled={enabled} loading={flow.suLoading} style={{ marginBottom: '16px' }}>
                  Create Account →
                </SubmitButton>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--sidebar-border)' }} />
        <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--sidebar-border)' }} />
      </div>

      <button
        type="button"
        onClick={() => flow.handleOAuthSignIn('google')}
        disabled={flow.isAnyLoading}
        style={{ ...oauthStyle(flow.isAnyLoading), marginBottom: '10px' }}
      >
        {flow.oauthLoading === 'google' ? (
          <Spinner />
        ) : (
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.03-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        Continue with Google
      </button>

      <button
        type="button"
        onClick={() => flow.handleOAuthSignIn('github')}
        disabled={flow.isAnyLoading}
        style={oauthStyle(flow.isAnyLoading)}
      >
        {flow.oauthLoading === 'github' ? (
          <Spinner />
        ) : (
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
          </svg>
        )}
        Continue with GitHub
      </button>
    </div>
  );
}

export function MobileAuthView({ flow }: { flow: AuthFlow }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: 'var(--background)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
        fontFamily: 'var(--font-geist-sans), sans-serif',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggle variant="icon" />
      </div>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span
            style={{
              fontFamily: 'var(--font-geist-mono), monospace',
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--text-white)',
              letterSpacing: '-0.02em',
            }}
          >
            {siteConfig.logoWord}<span style={{ color: '#ff6b00' }}>.</span>
          </span>
        </Link>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: '6px 0 0 0' }}>
          {siteConfig.tagline}
        </p>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'var(--auth-card-bg)',
          border: '1px solid var(--auth-card-border)',
          borderRadius: '20px',
          padding: '28px 20px',
          boxSizing: 'border-box',
          boxShadow: 'var(--auth-card-shadow)',
        }}
      >
        {flow.mode === 'verify' ? (
          <VerifyScreen flow={flow} />
        ) : flow.mode === 'forgot' ? (
          <ForgotScreen flow={flow} />
        ) : flow.mode === 'reset' ? (
          <ResetScreen flow={flow} />
        ) : (
          <FormScreen flow={flow} />
        )}
      </div>
    </div>
  );
}

/** Standalone mobile auth (owns its own flow state). */
export function MobileAuth() {
  const flow = useAuthFlow();
  return <MobileAuthView flow={flow} />;
}
