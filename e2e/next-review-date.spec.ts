import { test, expect } from '@playwright/test';
import { clearUserData } from './helpers';

test.beforeEach(async ({ request }) => {
  await clearUserData(request);
});

test('the next review date can be changed from the dashboard', async ({ page }) => {
  const title = `E2E reschedule ${Date.now()}`;
  const created = await page.request.post('/api/concepts', {
    data: { title, category: 'Fundamentals', level: 'MEDIUM' },
  });
  expect(created.status(), await created.text()).toBeLessThan(300);

  await page.goto('/dashboard');
  const row = page.locator('tr', { hasText: title });
  const cell = row.getByRole('button', { name: /^Next review .+\. Change date$/ });
  await expect(cell).toBeVisible();

  // The table scrolls sideways at this width, and the popover closes on any scroll (it is
  // pinned to the cell). Bring the cell into view first so the click's own auto-scroll
  // can't close it, and retry the click if a late scroll event still does.
  await cell.scrollIntoViewIfNeeded();
  const dialog = page.getByRole('dialog', { name: 'Change next review date' });
  await expect(async () => {
    if (!(await dialog.isVisible())) await cell.click();
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await dialog.getByRole('button', { name: /In 1 week/ }).click();

  await expect(dialog).toBeHidden();
  await expect(cell).toContainText('in 7d');

  // And it was saved.
  await page.reload();
  await expect(page.locator('tr', { hasText: title }).getByRole('button', { name: /Change date$/ })).toContainText('in 7d');
});
