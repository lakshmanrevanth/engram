import { test as setup, expect } from '@playwright/test';
import { STORAGE_STATE, readTestUser } from './paths';

// Signs in once through the real login form and saves the session for the specs.
// The login page renders a desktop and a mobile layout and hides one with CSS,
// so every locator is restricted to visible elements.
setup('sign in as the e2e user', async ({ page }) => {
  const { email, password } = readTestUser();

  await page.goto('/auth/login');
  const emailInput = page.locator('input[type="email"]:visible').first();
  const passwordInput = page.locator('input[type="password"]:visible').first();
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await passwordInput.press('Enter');

  await page.waitForURL('**/dashboard', { timeout: 45_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: STORAGE_STATE });
});
