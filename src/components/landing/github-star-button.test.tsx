import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// siteConfig reads NEXT_PUBLIC_GITHUB_REPO at import time, so each test loads a
// fresh copy of the module after setting the env var.
async function loadButton(repo: string) {
  vi.stubEnv('NEXT_PUBLIC_GITHUB_REPO', repo);
  vi.resetModules();
  return (await import('./github-star-button')).GitHubStarButton;
}

describe('GitHubStarButton', () => {
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it('uses the same initial markup when cached stars exist in the browser', async () => {
    const GitHubStarButton = await loadButton('owner/repo');
    const serverMarkup = renderToStaticMarkup(<GitHubStarButton />);

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: () => '9',
        },
      },
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => '9',
      },
    });

    const clientMarkup = renderToStaticMarkup(<GitHubStarButton />);

    expect(clientMarkup).toBe(serverMarkup);
  });

  it('renders sidebar variant linking to the configured repo', async () => {
    const GitHubStarButton = await loadButton('owner/repo');
    const markup = renderToStaticMarkup(<GitHubStarButton variant="sidebar" />);
    expect(markup).toContain('data-sidebar-github');
    expect(markup).toContain('Star on GitHub');
    expect(markup).toContain('https://github.com/owner/repo');
    expect(markup).toContain('Star Engram on GitHub');
  });

  it('renders nothing when no repo is configured', async () => {
    const GitHubStarButton = await loadButton('');
    expect(renderToStaticMarkup(<GitHubStarButton />)).toBe('');
    expect(renderToStaticMarkup(<GitHubStarButton variant="sidebar" />)).toBe('');
  });
});
