import { expect, test } from '@playwright/test';

import { signIn } from './sign-in.ts';

test('an admin signs in and sees the events from the database', async ({ page }) => {
  await signIn(page, 'admin@demo.test');

  await page.getByRole('link', { name: 'Events' }).click();

  await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
  await expect(page.getByRole('row').nth(1)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Logs' })).toBeVisible();
});
