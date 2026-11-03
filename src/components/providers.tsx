'use client';

import { SessionProvider } from 'next-auth/react';
import { SWRConfig } from 'swr';
import { localStorageProvider } from '@/lib/swr-cache';
import { TZ_COOKIE } from '@/lib/dates';

// Tell the server the user's timezone so streaks, the heatmap and "completed today"
// use the user's calendar day. Runs once when this module loads in the browser,
// before any child component starts fetching.
if (typeof document !== 'undefined') {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      document.cookie = `${TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    }
  } catch {
    // Older browsers without Intl timezone support fall back to UTC on the server.
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SWRConfig
        value={{
          provider: localStorageProvider,
          revalidateOnFocus: false,
          revalidateIfStale: true,
          dedupingInterval: 2000,
          focusThrottleInterval: 30000,
        }}
      >
        {children}
      </SWRConfig>
    </SessionProvider>
  );
}
