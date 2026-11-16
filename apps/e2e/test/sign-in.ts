import { expect, type Page } from '@playwright/test';

import { DEMO_PASSWORD } from './e2e-env.ts';

export async function signIn(page: Page, email: string, password = DEMO_PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * Signs out through the account menu and waits for the sign-in page. Opening /login before the
 * logout request ends would find the session still alive and be sent straight back into the app.
 */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Account menu/ }).click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login/);
}
