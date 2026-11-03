// Only allow redirects to pages on this site after login.
// "/dashboard" is fine; "https://evil.com", "//evil.com" and "/\evil.com" are not.
export function safeCallbackUrl(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
