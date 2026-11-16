import { expect, test } from '@playwright/test';

import { signIn, signOut } from './sign-in.ts';

test('an admin signs in and sees the events from the database', async ({ page }) => {
  await signIn(page, 'admin@demo.test');

  // Staff start on their dashboard, which has the pinned events section.
  await expect(page.getByRole('heading', { name: 'Pinned events' })).toBeVisible();
  // Exact: the dashboard also links to "Published events".
  await page.getByRole('link', { name: 'Events', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible();
  await expect(page.getByRole('row').nth(1)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Logs', exact: true })).toBeVisible();
});

test('only the super admin can change or delete an admin', async ({ page }) => {
  const admins = '/users?filters[0][field]=role&filters[0][operator]=eq&filters[0][value]=ADMIN';

  await signIn(page, 'admin@demo.test');
  await page.goto(admins);
  await expect(page.getByRole('gridcell', { name: 'Demo Admin', exact: true })).toBeVisible();
  // An admin can rename their own account, but never delete it or another admin.
  await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0);

  await signOut(page);
  await signIn(page, 'owner@demo.test');
  await page.goto(admins);

  await expect(page.getByRole('button', { name: 'Delete Demo Admin' })).toBeVisible();
});
