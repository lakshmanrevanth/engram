'use client';

// All state and handlers for the login / signup / verify / forgot / reset flow.
// Both the desktop and mobile views render from this one hook so their
// behaviour can't drift apart.

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { safeCallbackUrl } from '@/lib/safe-redirect';

export type AuthTab = 'signin' | 'signup';
export type AuthMode = 'form' | 'verify' | 'forgot' | 'reset';
export type OAuthProvider = 'google' | 'github';

export const RESEND_COOLDOWN_SEC = 60;

export const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked:
    'This email is already registered with a different sign-in method. Try signing in with the method you used originally.',
  OAuthCallback: 'Something went wrong with the OAuth login. Please try again.',
  OAuthSignin: 'Could not start the OAuth sign-in flow. Please try again.',
  CredentialsSignin: 'Invalid email or password.',
  EmailNotVerified: 'Your email is not verified yet. Please enter the verification code sent to your email.',
  SessionRequired: 'Please sign in to access this page.',
  RateLimited: 'Too many sign-in attempts. Please wait a few minutes and try again.',
  Default: 'An unexpected error occurred. Please try again.',
};

/** Map a NextAuth signIn() result to a message (null for email_not_verified, which has its own screen). */
export function signInErrorMessage(res: { error?: string | null; code?: string | null } | undefined): string | null {
  if (!res?.error) return null;
  if (res.code === 'email_not_verified') return null;
  if (res.code === 'rate_limited') return errorMessages.RateLimited;
  return errorMessages.CredentialsSignin;
}

const normalize = (email: string) => email.trim().toLowerCase();

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; json: { error?: string; message?: string; requiresVerification?: boolean } }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return [seconds, setSeconds] as const;
}

export function useAuthFlow() {
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'));

  const [tab, setTab] = useState<AuthTab>('signin');
  const [mode, setMode] = useState<AuthMode>('form');

  // Sign in
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siError, setSiError] = useState('');
  const [siLoading, setSiLoading] = useState(false);

  // Sign up
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suError, setSuError] = useState('');
  const [suLoading, setSuLoading] = useState(false);

  // Verify email
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useCountdown();
  const [resendLoading, setResendLoading] = useState(false);

  // Forgot / reset password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useCountdown();

  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  // Show ?error= from NextAuth redirects (updated during render, not in an effect).
  const errorParam = searchParams.get('error');
  const [seenErrorParam, setSeenErrorParam] = useState<string | null>(null);
  if (errorParam !== seenErrorParam) {
    setSeenErrorParam(errorParam);
    if (errorParam) setSiError(errorMessages[errorParam] || errorMessages.Default);
  }

  const goToSignIn = useCallback((email?: string) => {
    setMode('form');
    setTab('signin');
    if (email !== undefined) setSiEmail(email);
  }, []);

  // Show the verify screen for `email` and ask the server for a fresh code.
  const promptVerify = useCallback(
    (email: string, password: string, notice = '') => {
      const clean = normalize(email);
      setVerifyEmail(clean);
      setVerifyPassword(password);
      setOtp('');
      setVerifyError('');
      setResendSuccess(notice);
      setMode('verify');
      if (!clean) return;
      postJson('/api/auth/resend-code', { email: clean })
        .then(({ ok, json }) => {
          if (ok) {
            setResendSuccess(notice || json.message || 'Verification code sent to your email.');
            setResendCooldown(RESEND_COOLDOWN_SEC);
          } else if (json.error) {
            setVerifyError(json.error);
          }
        })
        .catch(() => {});
    },
    [setResendCooldown]
  );

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    setSiError('');
    setSuError('');
    setOauthLoading(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      setSiError(errorMessages.OAuthSignin);
      setOauthLoading(null);
    }
  };

  const handleSignIn = async () => {
    setSiError('');
    setForgotSuccess('');
    if (!siEmail.trim() || !siPassword) {
      setSiError('Please enter your email and password.');
      return;
    }
    setSiLoading(true);
    try {
      const res = await signIn('credentials', {
        email: normalize(siEmail),
        password: siPassword,
        callbackUrl,
        redirect: false,
      });
      if (res?.error) {
        if (res.code === 'email_not_verified') {
          promptVerify(siEmail, siPassword, 'Your email isn’t verified yet. We’ve sent you a new code.');
        } else {
          setSiError(signInErrorMessage(res) ?? errorMessages.Default);
        }
      } else {
        window.location.href = callbackUrl;
      }
    } catch {
      setSiError(errorMessages.Default);
    } finally {
      setSiLoading(false);
    }
  };

  const handleSignUp = async () => {
    setSuError('');
    if (!suEmail.trim()) {
      setSuError('Please enter your email address.');
      return;
    }
    if (suPassword.length < 8) {
      setSuError('Password must be at least 8 characters.');
      return;
    }
    setSuLoading(true);
    try {
      const { ok, json } = await postJson('/api/auth/signup', { name: suName, email: suEmail, password: suPassword });
      if (!ok) {
        setSuError(json.error ?? 'Sign up failed.');
        return;
      }
      // The server answers the same way for new and existing emails.
      setVerifyEmail(normalize(suEmail));
      setVerifyPassword(suPassword);
      setOtp('');
      setVerifyError('');
      setResendSuccess('');
      setResendCooldown(RESEND_COOLDOWN_SEC);
      setMode('verify');
    } catch {
      setSuError('Something went wrong. Please try again.');
    } finally {
      setSuLoading(false);
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    if (code.length !== 6) {
      setVerifyError('Please enter the full 6-digit verification code.');
      return;
    }
    if (verifyLoading) return;
    setVerifyError('');
    setResendSuccess('');
    setVerifyLoading(true);

    try {
      const { ok, json } = await postJson('/api/auth/verify-code', { email: verifyEmail, code });
      if (!ok) {
        setVerifyError(json.error || 'Verification failed. Please check the code.');
        return;
      }

      // Sign in straight away if we still have the password from this visit.
      if (verifyPassword) {
        const loginRes = await signIn('credentials', {
          email: verifyEmail,
          password: verifyPassword,
          callbackUrl,
          redirect: false,
        });
        if (loginRes?.error) {
          goToSignIn(verifyEmail);
          setSiError('Email verified! Please sign in with your password.');
        } else {
          window.location.href = callbackUrl;
        }
      } else {
        goToSignIn(verifyEmail);
        setSiError('');
        setForgotSuccess('Email verified! Please sign in.');
      }
    } catch {
      setVerifyError('Something went wrong. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setVerifyError('');
    setResendSuccess('');
    try {
      const { ok, json } = await postJson('/api/auth/resend-code', { email: verifyEmail });
      if (!ok) {
        setVerifyError(json.error || 'Failed to resend code.');
      } else {
        setResendSuccess(json.message || 'New verification code sent to your inbox!');
        setResendCooldown(RESEND_COOLDOWN_SEC);
      }
    } catch {
      setVerifyError('Failed to resend code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const openForgot = () => {
    setForgotEmail(siEmail);
    setForgotError('');
    setForgotSuccess('');
    setMode('forgot');
  };

  const sendResetCode = async (): Promise<{ ok: boolean; error?: string; message?: string }> => {
    const { ok, json } = await postJson('/api/auth/forgot-password', { email: normalize(forgotEmail) });
    return { ok, error: json.error, message: json.message };
  };

  const handleRequestPasswordReset = async () => {
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address.');
      return;
    }
    setForgotError('');
    setForgotSuccess('');
    setForgotLoading(true);
    try {
      const res = await sendResetCode();
      if (!res.ok) {
        setForgotError(res.error || 'Failed to send reset code.');
      } else {
        setForgotSuccess(res.message || 'If an account exists, a reset code was sent.');
        setForgotCooldown(RESEND_COOLDOWN_SEC);
        setResetOtp('');
        setResetNewPassword('');
        setResetConfirmPassword('');
        setResetError('');
        setMode('reset');
      }
    } catch {
      setForgotError('Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    if (forgotCooldown > 0 || forgotLoading) return;
    setForgotLoading(true);
    setResetError('');
    setForgotSuccess('');
    try {
      const res = await sendResetCode();
      if (!res.ok) {
        setResetError(res.error || 'Failed to resend code.');
      } else {
        setForgotSuccess(res.message || 'New reset code sent to your inbox!');
        setForgotCooldown(RESEND_COOLDOWN_SEC);
      }
    } catch {
      setResetError('Failed to resend reset code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (resetOtp.length !== 6) {
      setResetError('Please enter the 6-digit reset code.');
      return;
    }
    if (resetNewPassword.length < 8) {
      setResetError('Password must be at least 8 characters long.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    setResetError('');
    setResetLoading(true);
    try {
      const { ok, json } = await postJson('/api/auth/reset-password', {
        email: normalize(forgotEmail),
        code: resetOtp,
        newPassword: resetNewPassword,
      });
      if (!ok) {
        setResetError(json.error || 'Failed to reset password.');
      } else {
        goToSignIn(forgotEmail);
        setSiPassword('');
        setSiError('');
        setForgotSuccess('Password reset successfully! Please sign in with your new password.');
      }
    } catch {
      setResetError('Something went wrong. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleNeedVerify = () => {
    if (siEmail.trim()) {
      promptVerify(siEmail, siPassword);
    } else {
      setSiError('Enter the email you signed up with above, then choose “Enter code” again.');
    }
  };

  const backFromVerify = () => {
    setMode('form');
    setVerifyError('');
    setResendSuccess('');
  };

  const backFromForgot = () => {
    setMode('form');
    setForgotError('');
  };

  const backFromReset = () => {
    setMode('forgot');
    setResetError('');
  };

  const isAnyLoading =
    siLoading || suLoading || verifyLoading || forgotLoading || resetLoading || oauthLoading !== null;

  return {
    callbackUrl,
    tab, setTab, mode, setMode,
    siEmail, setSiEmail, siPassword, setSiPassword, siError, siLoading,
    suName, setSuName, suEmail, setSuEmail, suPassword, setSuPassword, suError, suLoading,
    verifyEmail, setVerifyEmail, otp, setOtp, verifyLoading, verifyError, resendSuccess, resendCooldown, resendLoading,
    forgotEmail, setForgotEmail, forgotError, forgotSuccess, forgotLoading, forgotCooldown,
    resetOtp, setResetOtp, resetNewPassword, setResetNewPassword, resetConfirmPassword, setResetConfirmPassword,
    resetError, resetLoading,
    oauthLoading, isAnyLoading,
    handleOAuthSignIn, handleSignIn, handleSignUp, handleVerifyCode, handleResendCode,
    handleRequestPasswordReset, handleResendResetCode, handleResetPassword,
    handleNeedVerify, openForgot, goToSignIn, backFromVerify, backFromForgot, backFromReset,
  };
}

export type AuthFlow = ReturnType<typeof useAuthFlow>;

/** Wrap a handler so it works as a <form onSubmit>. */
export function onSubmit(handler: () => void) {
  return (e: FormEvent) => {
    e.preventDefault();
    handler();
  };
}
