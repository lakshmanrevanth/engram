'use client';

import { useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';
import downloadImg from '../../../../utils/download.jpg';
import GridDistortion from '@/components/ui/grid-distortion';
import { useMediaQuery } from '@/hooks/use-media-query';
import { MobileAuthView } from '@/components/auth/mobile-auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { OtpInput } from '@/components/auth/otp-input';
import { useAuthFlow, onSubmit, type AuthFlow } from '@/components/auth/use-auth-flow';
import { siteConfig } from '@/config/site';

// Both layouts are rendered and CSS picks one, so there is no flash of the
// wrong layout while JS loads. mobile.css already hides the left panel <=1024px.
const LAYOUT_CSS = `
.auth-view-mobile { display: none; }
@media (max-width: 768px) {
  .auth-view-desktop { display: none; }
  .auth-view-mobile { display: block; }
}
`;

function Spinner({ color = 'var(--foreground)' }: { color?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: `2px solid ${color}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
        flexShrink: 0,
      }}
    />
  );
}

function Input({
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
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label htmlFor={id} style={{ display: 'block', fontSize: 13, color: 'var(--text-dim)' }}>{label}</label>
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
            background: 'var(--input-bg)',
            border: `1px solid ${focused ? 'var(--input-focus-border)' : 'var(--input-border)'}`,
            boxShadow: focused ? '0 0 0 3px var(--otp-focus-ring)' : 'none',
            borderRadius: 6,
            color: 'var(--foreground)',
            fontSize: 14,
            padding: isPassword ? '10px 38px 10px 14px' : '10px 14px',
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
              right: 10,
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
              transition: 'color 0.15s',
            }}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-controls={id}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

function PrimaryButton({ children, loading, disabled }: { children: React.ReactNode; loading?: boolean; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      style={{
        width: '100%',
        background: loading || disabled ? 'var(--input-border)' : 'var(--primary)',
        color: loading || disabled ? 'var(--text-dim)' : 'var(--primary-foreground)',
        borderWidth: 0,
        borderRadius: 6,
        fontSize: 14,
        fontWeight: 500,
        padding: '11px 0',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'all 0.15s',
        marginBottom: 8,
      }}
    >
      {loading ? <Spinner color="var(--text-dim)" /> : children}
    </button>
  );
}

function OAuthButton({ provider, label, onClick, loading, disabled }: { provider: 'google' | 'github'; label: string; onClick: () => void; loading?: boolean; disabled?: boolean }) {
  const isGoogle = provider === 'google';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        width: '100%',
        background: 'transparent',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'var(--input-border)',
        borderRadius: 6,
        color: loading || disabled ? 'var(--text-muted)' : 'var(--foreground)',
        fontSize: 14,
        padding: '10px 0',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 8,
        transition: 'border-color 0.15s',
        opacity: disabled && !loading ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!loading && !disabled) e.currentTarget.style.borderColor = 'var(--foreground)';
      }}
      onMouseLeave={(e) => {
        if (!loading && !disabled) e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {loading ? (
        <Spinner color="var(--muted-foreground)" />
      ) : isGoogle ? (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.03-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      ) : (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
        </svg>
      )}
      {loading ? 'Connecting...' : label}
    </button>
  );
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>or</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

const noticeBase: React.CSSProperties = {
  fontSize: 13,
  borderRadius: 6,
  padding: '10px 14px',
  marginBottom: 16,
  lineHeight: 1.4,
};

// Errors use role="alert"; successes sit in a polite live region so screen readers announce them.
function Notices({ error, success, mono }: { error?: string; success?: string; mono?: boolean }) {
  return (
    <>
      <div aria-live="polite" aria-atomic="true">
        {success && (
          <div style={{ ...noticeBase, color: 'var(--success)', background: 'var(--success-bg)', border: '1px solid var(--success-border)' }}>
            {success}
          </div>
        )}
      </div>
      {error && (
        <div
          role="alert"
          style={{
            ...noticeBase,
            color: 'var(--error)',
            background: 'var(--error-bg)',
            border: '1px solid var(--error-border)',
            fontFamily: mono ? 'var(--font-geist-mono), monospace' : undefined,
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}

const linkButton: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--foreground)',
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: 0,
};

function BackButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--muted-foreground)',
        fontSize: 13,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: 0,
        marginBottom: 16,
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted-foreground)')}
    >
      {children}
    </button>
  );
}

function ScreenHeading({ children }: { children: React.ReactNode }) {
  return (
    <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.02em', margin: '0 0 6px 0' }}>
      {children}
    </h1>
  );
}

const screenMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2 },
};

function TabButton({ flow, value, label }: { flow: AuthFlow; value: 'signin' | 'signup'; label: string }) {
  const active = flow.tab === value;
  return (
    <button
      type="button"
      role="tab"
      id={`d-tab-${value}`}
      aria-selected={active}
      aria-controls={`d-panel-${value}`}
      onClick={() => flow.setTab(value)}
      disabled={flow.isAnyLoading}
      style={{
        background: 'none',
        borderWidth: 0,
        cursor: flow.isAnyLoading ? 'not-allowed' : 'pointer',
        fontSize: 15,
        fontWeight: 500,
        color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
        padding: '0 0 10px 0',
        marginRight: value === 'signin' ? 24 : 0,
        position: 'relative',
        transition: 'color 0.15s ease',
      }}
    >
      {label}
      {active && (
        <motion.div
          layoutId="activeTabIndicator"
          style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--foreground)', borderRadius: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </button>
  );
}

function OAuthButtons({ flow }: { flow: AuthFlow }) {
  return (
    <>
      <OAuthButton
        provider="google"
        label="Continue with Google"
        onClick={() => flow.handleOAuthSignIn('google')}
        loading={flow.oauthLoading === 'google'}
        disabled={flow.isAnyLoading}
      />
      <OAuthButton
        provider="github"
        label="Continue with GitHub"
        onClick={() => flow.handleOAuthSignIn('github')}
        loading={flow.oauthLoading === 'github'}
        disabled={flow.isAnyLoading}
      />
    </>
  );
}

function VerifyScreen({ flow }: { flow: AuthFlow }) {
  return (
    <motion.div key="verify-screen" {...screenMotion}>
      <div style={{ marginBottom: 20 }}>
        <BackButton onClick={flow.backFromVerify}>← Back</BackButton>
        <ScreenHeading>Check your email</ScreenHeading>
        <p id="d-verify-desc" style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5 }}>
          We sent a 6-digit verification code to <strong style={{ color: 'var(--foreground)' }}>{flow.verifyEmail}</strong>. Enter it below to verify your account.
        </p>
      </div>

      <Notices error={flow.verifyError} success={flow.resendSuccess} mono />

      <form onSubmit={onSubmit(() => flow.handleVerifyCode())} noValidate>
        <OtpInput
          idPrefix="d-verify-otp"
          labelledBy="d-verify-desc"
          value={flow.otp}
          onChange={flow.setOtp}
          onComplete={(code) => flow.handleVerifyCode(code)}
          disabled={flow.verifyLoading}
          error={!!flow.verifyError}
          autoFocus
        />
        <PrimaryButton loading={flow.verifyLoading} disabled={flow.otp.length !== 6}>
          Verify & Continue →
        </PrimaryButton>
      </form>

      <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--muted-foreground)' }}>
        {flow.resendCooldown > 0 ? (
          <span>Resend code in <strong style={{ color: 'var(--foreground)' }}>{flow.resendCooldown}s</strong></span>
        ) : (
          <span>
            Didn&apos;t receive the code?{' '}
            <button type="button" onClick={flow.handleResendCode} disabled={flow.resendLoading} style={{ ...linkButton, fontSize: 13, fontWeight: 500 }}>
              {flow.resendLoading ? 'Sending...' : 'Resend code'}
            </button>
          </span>
        )}
      </div>

      <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: 'var(--muted-foreground)' }}>
        Entered the wrong email?{' '}
        <button type="button" onClick={() => flow.setMode('form')} style={{ ...linkButton, fontSize: 12 }}>
          Change email
        </button>
        {' · '}Already verified?{' '}
        <button type="button" onClick={() => flow.goToSignIn(flow.verifyEmail)} style={{ ...linkButton, fontSize: 12 }}>
          Sign in
        </button>
      </div>
    </motion.div>
  );
}

function ForgotScreen({ flow }: { flow: AuthFlow }) {
  return (
    <motion.div key="forgot-screen" {...screenMotion}>
      <div style={{ marginBottom: 20 }}>
        <BackButton onClick={flow.backFromForgot}>← Back to sign in</BackButton>
        <ScreenHeading>Reset your password</ScreenHeading>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5 }}>
          Enter your registered email address and we&apos;ll send you a 6-digit code to reset your password.
        </p>
      </div>

      <Notices error={flow.forgotError} />

      <form onSubmit={onSubmit(flow.handleRequestPasswordReset)} noValidate>
        <Input
          id="d-forgot-email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={flow.forgotEmail}
          onChange={flow.setForgotEmail}
          placeholder="you@example.com"
        />
        <PrimaryButton loading={flow.forgotLoading} disabled={!flow.forgotEmail.trim()}>
          Send reset code →
        </PrimaryButton>
      </form>

      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'var(--muted-foreground)' }}>
        Remembered your password?{' '}
        <button type="button" onClick={() => flow.goToSignIn()} style={{ ...linkButton, fontSize: 12 }}>
          Sign in
        </button>
      </div>
    </motion.div>
  );
}

function ResetScreen({ flow }: { flow: AuthFlow }) {
  return (
    <motion.div key="reset-screen" {...screenMotion}>
      <div style={{ marginBottom: 20 }}>
        <BackButton onClick={flow.backFromReset}>← Change email</BackButton>
        <ScreenHeading>Set new password</ScreenHeading>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5 }}>
          Enter the 6-digit code sent to <strong style={{ color: 'var(--foreground)' }}>{flow.forgotEmail}</strong> and choose a new password.
        </p>
      </div>

      <Notices error={flow.resetError} success={flow.forgotSuccess} />

      <form onSubmit={onSubmit(flow.handleResetPassword)} noValidate>
        {/* Hidden username helps password managers save the new password against the right account. */}
        <input type="email" name="email" autoComplete="username" value={flow.forgotEmail} readOnly hidden />
        <div style={{ marginBottom: 16 }}>
          <div id="d-reset-otp-label" style={{ display: 'block', fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8 }}>
            6-digit reset code
          </div>
          <OtpInput
            idPrefix="d-reset-otp"
            labelledBy="d-reset-otp-label"
            value={flow.resetOtp}
            onChange={flow.setResetOtp}
            disabled={flow.resetLoading}
            error={!!flow.resetError}
            autoFocus
          />
        </div>

        <Input
          id="d-reset-new"
          name="new-password"
          label="New password (min 8 characters)"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={flow.resetNewPassword}
          onChange={flow.setResetNewPassword}
          placeholder="••••••••"
        />
        <Input
          id="d-reset-confirm"
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

        <PrimaryButton
          loading={flow.resetLoading}
          disabled={flow.resetOtp.length !== 6 || flow.resetNewPassword.length < 8 || !flow.resetConfirmPassword}
        >
          Reset password →
        </PrimaryButton>
      </form>

      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--muted-foreground)' }}>
        {flow.forgotCooldown > 0 ? (
          <span>Resend code in <strong style={{ color: 'var(--foreground)' }}>{flow.forgotCooldown}s</strong></span>
        ) : (
          <span>
            Didn&apos;t receive the code?{' '}
            <button type="button" onClick={flow.handleResendResetCode} disabled={flow.forgotLoading} style={{ ...linkButton, fontSize: 13, fontWeight: 500 }}>
              {flow.forgotLoading ? 'Sending...' : 'Resend code'}
            </button>
          </span>
        )}
      </div>
    </motion.div>
  );
}

const subtleLink: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--muted-foreground)',
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
  transition: 'color 0.15s',
};

function FormScreen({ flow }: { flow: AuthFlow }) {
  return (
    <div>
      <div role="tablist" aria-label="Sign in or sign up" style={{ display: 'flex', marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0, position: 'relative' }}>
        <TabButton flow={flow} value="signin" label="Sign in" />
        <TabButton flow={flow} value="signup" label="Sign up" />
      </div>

      <AnimatePresence mode="wait">
        {flow.tab === 'signin' ? (
          <motion.div
            key="signin"
            id="d-panel-signin"
            role="tabpanel"
            aria-labelledby="d-tab-signin"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <Notices error={flow.siError} success={flow.forgotSuccess} />
            <form onSubmit={onSubmit(flow.handleSignIn)} noValidate>
              <Input
                id="d-signin-email"
                name="email"
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={flow.siEmail}
                onChange={flow.setSiEmail}
                placeholder="you@example.com"
              />
              <Input
                id="d-signin-password"
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
                    style={subtleLink}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                  >
                    Forgot password?
                  </button>
                }
              />
              <PrimaryButton loading={flow.siLoading} disabled={flow.isAnyLoading}>Sign in →</PrimaryButton>
            </form>
            <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 4 }}>
              <button
                type="button"
                onClick={flow.handleNeedVerify}
                style={subtleLink}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted-foreground)')}
              >
                Need to verify your signup email? Enter code →
              </button>
            </div>
            <Divider />
            <OAuthButtons flow={flow} />
            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--muted-foreground)' }}>
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => flow.setTab('signup')} style={{ ...linkButton, fontSize: 13 }}>Sign up</button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="signup"
            id="d-panel-signup"
            role="tabpanel"
            aria-labelledby="d-tab-signup"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <Notices error={flow.suError} mono />
            <form onSubmit={onSubmit(flow.handleSignUp)} noValidate>
              <Input
                id="d-signup-name"
                name="name"
                label="Name (optional)"
                type="text"
                autoComplete="name"
                value={flow.suName}
                onChange={flow.setSuName}
                placeholder="Your name"
              />
              <Input
                id="d-signup-email"
                name="email"
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={flow.suEmail}
                onChange={flow.setSuEmail}
                placeholder="you@example.com"
              />
              <Input
                id="d-signup-password"
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
              <PrimaryButton loading={flow.suLoading} disabled={flow.isAnyLoading}>Create account →</PrimaryButton>
            </form>
            <Divider />
            <OAuthButtons flow={flow} />
            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--muted-foreground)' }}>
              Already have an account?{' '}
              <button type="button" onClick={() => flow.setTab('signin')} style={{ ...linkButton, fontSize: 13 }}>Sign in</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DesktopAuthView({ flow }: { flow: AuthFlow }) {
  // The WebGL panel is only visible above 1024px, so only start it there.
  const showArt = useMediaQuery('(min-width: 1025px)');

  return (
    <div data-auth-container style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--background)' }}>
      {/* Left panel (40%) — hidden on tablet/mobile by mobile.css */}
      <div
        data-auth-left
        style={{
          width: '40%',
          height: '100vh',
          padding: '20px 10px 20px 20px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: 24,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            background: 'var(--card)',
          }}
        >
          {showArt && (
            <GridDistortion
              imageSrc={downloadImg.src || '/login-bg.jpg'}
              grid={15}
              mouse={0.1}
              strength={0.15}
              relaxation={0.9}
            />
          )}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'linear-gradient(180deg, rgba(10, 10, 11, 0.1) 0%, rgba(10, 10, 11, 0.85) 100%)',
            }}
          />

          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '36px', pointerEvents: 'none', zIndex: 2 }}>
            <h2
              style={{
                fontFamily: 'var(--font-geist-sans), sans-serif',
                fontSize: '24px',
                fontWeight: 600,
                color: '#ffffff',
                letterSpacing: '-0.02em',
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {siteConfig.taglineLines[0]}<br />
              <span style={{ color: '#a1a1aa', fontWeight: 400 }}>{siteConfig.taglineLines[1]}</span>
            </h2>
          </div>
        </div>
      </div>

      {/* Right panel (60%) — form */}
      <div
        data-auth-right
        style={{
          width: '60%',
          height: '100vh',
          padding: '20px 20px 20px 10px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <div
          data-auth-card
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 24,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 10 }}>
            <ThemeToggle variant="icon" />
          </div>

          <div style={{ width: '100%', maxWidth: 400 }}>
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
      </div>
    </div>
  );
}

function LoginContent() {
  const flow = useAuthFlow();
  return (
    <>
      <style>{LAYOUT_CSS}</style>
      <div className="auth-view-desktop">
        <DesktopAuthView flow={flow} />
      </div>
      <div className="auth-view-mobile">
        <MobileAuthView flow={flow} />
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ background: 'var(--background)', minHeight: '100vh' }} />}>
      <LoginContent />
    </Suspense>
  );
}
