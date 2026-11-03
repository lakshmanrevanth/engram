import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, isTheme, resolveTheme, useTheme } from './theme-provider';

function ShowTheme() {
  const { theme, resolvedTheme } = useTheme();
  return <span>{`${theme}/${resolvedTheme}`}</span>;
}

describe('ThemeProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not render an initialization script inside the client provider', () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <span>content</span>
      </ThemeProvider>
    );

    expect(markup).not.toContain('<script');
  });

  it('defaults to "system" and renders dark on the server', () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <ShowTheme />
      </ThemeProvider>
    );
    expect(markup).toContain('system/dark');
  });

  it('respects an explicit default theme', () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider defaultTheme="light">
        <ShowTheme />
      </ThemeProvider>
    );
    expect(markup).toContain('light/light');
  });

  it('accepts the stored values used before "system" existed', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('system')).toBe(true);
    expect(isTheme('blue')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it('resolves "system" from prefers-color-scheme', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(resolveTheme('system')).toBe('light');
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    expect(resolveTheme('system')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  it('falls back to dark when matchMedia is unavailable', () => {
    vi.stubGlobal('window', {});
    expect(resolveTheme('system')).toBe('dark');
  });
});
