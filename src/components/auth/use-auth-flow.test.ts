import { describe, it, expect, vi } from 'vitest';

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

import { signInErrorMessage, errorMessages } from './use-auth-flow';

describe('signInErrorMessage', () => {
  it('returns null on success', () => {
    expect(signInErrorMessage({ error: null })).toBeNull();
    expect(signInErrorMessage(undefined)).toBeNull();
  });
  it('returns null for unverified email (handled by the verify screen)', () => {
    expect(signInErrorMessage({ error: 'CredentialsSignin', code: 'email_not_verified' })).toBeNull();
  });
  it('maps rate limiting to its own message', () => {
    expect(signInErrorMessage({ error: 'CredentialsSignin', code: 'rate_limited' })).toBe(errorMessages.RateLimited);
  });
  it('falls back to invalid email or password', () => {
    expect(signInErrorMessage({ error: 'CredentialsSignin', code: 'credentials' })).toBe(errorMessages.CredentialsSignin);
  });
});
