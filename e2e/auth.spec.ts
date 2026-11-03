import { test, expect } from '@playwright/test';

// These checks run signed out.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('signed out', () => {
  test('a protected page redirects to the login page', async ({ page }) => {
    await page.goto('/concepts');
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator('input[type="email"]:visible').first()).toBeVisible();
  });

  test('the API answers 401 without a session', async ({ request }) => {
    for (const path of ['/api/concepts', '/api/problems', '/api/settings']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(401);
    }
  });
});
