import { test, expect } from '@playwright/test';
import { clearUserData, localDateKey } from './helpers';

test.beforeEach(async ({ request }) => {
  await clearUserData(request);
});

test('a concept learned 10 days ago is due today and can be reviewed from the Daily queue', async ({ page }) => {
  await page.goto('/concepts');
  await page.getByRole('tab', { name: 'My concepts & library' }).click();

  // Pick the first library suggestion.
  const titleInput = page.locator('#concept-title');
  await titleInput.fill('hashing');
  const firstOption = page.getByRole('listbox').getByRole('option').first();
  await firstOption.getByRole('button').click();
  const title = await titleInput.inputValue();
  expect(title.length).toBeGreaterThan(0);

  await page.locator('#concept-date').fill(localDateKey(10));
  await page.getByRole('button', { name: 'Save and schedule reviews' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toContainText('is due today');

  await page.goto('/daily');
  const row = page.getByRole('group', { name: title, exact: true });
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: /show notes panel/i }).click();
  await row.getByRole('button', { name: /reveal notes/i }).click();
  await row.getByRole('button', { name: /as Clean/ }).click();

  await expect(page.getByRole('group', { name: title, exact: true })).toHaveCount(0);
  const completedHeader = page.getByRole('button', { name: /Completed Today/ });
  await expect(completedHeader).toBeVisible();
  // The section root is the innermost element that contains the header button.
  const completed = page.locator('div').filter({ has: completedHeader }).last();
  await expect(completed).toContainText(title);
});
