import { test, expect } from '@playwright/test';
import { clearUserData } from './helpers';

test.beforeEach(async ({ request }) => {
  await clearUserData(request);
});

test('System Design Fundamentals: learn article 1, unlock article 2, no skipping ahead', async ({ page }) => {
  await page.goto('/concepts');

  await expect(page.getByRole('tab', { name: 'Learning paths' })).toHaveAttribute('aria-selected', 'true');
  const paths = page.getByRole('region', { name: 'Learning paths' });
  await expect(paths.getByRole('button', { name: /Open path\.$/ })).toHaveCount(7);

  await paths.getByRole('button', { name: /^System Design Fundamentals: 0 of \d+ learned/ }).click();
  await expect(page.getByRole('heading', { name: 'System Design Fundamentals' })).toBeVisible();

  // Only the first article is unlocked.
  const markLearned = page.getByRole('button', { name: 'Mark as learned' });
  await expect(markLearned).toHaveCount(1);
  const current = page.locator('li[aria-current="step"]');
  await expect(current).toContainText('System Design for Beginners');

  await current.getByLabel(/Your notes/).fill('HLD = components and data flow; LLD = classes and interfaces.');
  await markLearned.click();

  await expect(page.getByRole('status')).toContainText(/Learned “System Design for Beginners.*Next up: Design a Load Balancer/);
  await expect(current).toContainText('Up next');
  await expect(current).toContainText('Design a Load Balancer');
  await expect(page.getByRole('button', { name: 'Mark as learned' })).toHaveCount(1);
  await expect(page.getByText(/^1 of \d+ learned$/)).toBeVisible();

  // The API enforces the order too: article 5 can't be learned before 2–4.
  const skip = await page.request.post('/api/concepts', {
    data: { pathArticleId: 'system-design-fundamentals-5' },
  });
  expect(skip.status()).toBe(409);
  expect((await skip.json()).code).toBe('PATH_ORDER');
});
