import { test, expect } from '@playwright/test';

test('the daily goal can be changed and persists after a reload', async ({ page }) => {
  await page.goto('/settings');
  const goal = page.getByRole('group', { name: 'Daily revision goal' });
  await expect(goal).toBeVisible();

  // Pick whichever preset isn't active, so the test works on a retry too.
  const ten = goal.getByRole('button', { name: '10 / day' });
  const target = (await ten.getAttribute('aria-pressed')) === 'true' ? '15 / day' : '10 / day';
  const button = goal.getByRole('button', { name: target });

  const saved = page.waitForResponse((r) => r.url().includes('/api/settings') && r.request().method() === 'PATCH');
  await button.click();
  expect((await saved).ok()).toBeTruthy();
  await expect(button).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(page.getByRole('group', { name: 'Daily revision goal' }).getByRole('button', { name: target })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});
