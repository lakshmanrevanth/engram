'use client';

import * as React from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  disableTransitionOnChange?: boolean;
};

type ThemeContextValue = {
  /** The user's choice, which may be "system". */
  theme: Theme;
  /** What is actually shown: light or dark. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);
const MEDIA = '(prefers-color-scheme: dark)';

let currentTheme: Theme = 'system';
let currentResolved: ResolvedTheme = 'dark';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function updateTheme(theme: Theme, resolved: ResolvedTheme) {
  currentTheme = theme;
  currentResolved = resolved;
  listeners.forEach((listener) => listener());
}

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredTheme(storageKey: string): Theme | null {
  try {
    const storedTheme = localStorage.getItem(storageKey);
    return isTheme(storedTheme) ? storedTheme : null;
  } catch {
    return null;
  }
}

export function getSystemTheme(): ResolvedTheme {
  try {
    return window.matchMedia(MEDIA).matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(theme: ResolvedTheme, disableTransitionOnChange: boolean) {
  const root = document.documentElement;
  const themeColor = theme === 'dark' ? '#080808' : '#ffffff';

  if (disableTransitionOnChange) {
    root.classList.add('disable-transitions');
    window.setTimeout(() => root.classList.remove('disable-transitions'), 0);
  }

  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = themeColor;
  });
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme',
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  // Keep the server and first client render identical. Stored preferences are
  // applied after hydration by the effect below.
  const theme = React.useSyncExternalStore(subscribe, () => currentTheme, () => defaultTheme);
  const resolvedTheme = React.useSyncExternalStore(
    subscribe,
    () => currentResolved,
    () => (defaultTheme === 'light' ? 'light' : 'dark')
  );

  React.useEffect(() => {
    const initialTheme = readStoredTheme(storageKey) ?? defaultTheme;
    const resolved = resolveTheme(initialTheme);
    updateTheme(initialTheme, resolved);
    applyTheme(resolved, false);
  }, [defaultTheme, storageKey]);

  // Follow the OS setting while "system" is selected.
  React.useEffect(() => {
    if (theme !== 'system') return;
    let media: MediaQueryList;
    try {
      media = window.matchMedia(MEDIA);
    } catch {
      return;
    }
    const onChange = () => {
      const resolved: ResolvedTheme = media.matches ? 'dark' : 'light';
      updateTheme('system', resolved);
      applyTheme(resolved, disableTransitionOnChange);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme, disableTransitionOnChange]);

  // Keep other tabs in sync.
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      const next = isTheme(e.newValue) ? e.newValue : defaultTheme;
      const resolved = resolveTheme(next);
      updateTheme(next, resolved);
      applyTheme(resolved, disableTransitionOnChange);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [defaultTheme, disableTransitionOnChange, storageKey]);

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      const resolved = resolveTheme(nextTheme);
      updateTheme(nextTheme, resolved);
      applyTheme(resolved, disableTransitionOnChange);
      try {
        localStorage.setItem(storageKey, nextTheme);
      } catch {
        // Theme changes still work when storage is unavailable.
      }
    },
    [disableTransitionOnChange, storageKey]
  );

  const value = React.useMemo(() => ({ theme, resolvedTheme, setTheme }), [setTheme, theme, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

