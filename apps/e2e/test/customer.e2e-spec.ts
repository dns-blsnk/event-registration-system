import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { signIn } from './sign-in.ts';

const PASSWORD = 'e2e-customer-password';
/** Enough catalog events to meet one with an upcoming session, whatever day the seed ran. */
const EVENTS_TO_TRY = 10;
/** What the admin says after a booking: a seat, or a place on the waitlist. */
const BOOKED = /^(Seat booked|Added to the waitlist|You are number \d+ on the waitlist)$/;

/** Opens catalog events in turn until one offers a session to book, and returns its button. */
async function findBookableSession(page: Page): Promise<Locator> {
  for (let index = 0; index < EVENTS_TO_TRY; index += 1) {
    await page.goto('/catalog');
    await page
      .getByRole('link', { name: /^Open / })
      .nth(index)
      .click();
    // The sessions arrive after the page; check for a button only once they are shown.
    await expect(page.getByRole('progressbar', { name: 'Seats left' }).first()).toBeVisible();
    const book = page.getByRole('button', { name: /^Book / }).first();
    if ((await book.count()) > 0) return book;
  }
  throw new Error(`No upcoming session in the first ${String(EVENTS_TO_TRY)} catalog events`);
}

test('a new customer signs up, books a seat from the catalog and sees it in their registrations', async ({
  page,
}) => {
  // A fresh account has no bookings, so no overlap rule can block the first one.
  await page.goto('/register');
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Customer');
  await page.getByRole('textbox', { name: 'Email' }).fill(`e2e-${randomUUID()}@test.local`);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).not.toHaveURL(/\/register/);

  const book = await findBookableSession(page);
  const sessionTitle = ((await book.getAttribute('aria-label')) ?? '').replace(/^Book /, '');
  expect(sessionTitle).not.toBe('');
  await book.click();
  await expect(page.getByText(BOOKED)).toBeVisible();

  await page.getByRole('link', { name: 'My registrations', exact: true }).click();
  await expect(page.getByRole('gridcell', { name: sessionTitle, exact: true })).toBeVisible();
});

test('a customer cannot open the users page', async ({ page }) => {
  await signIn(page, 'customer@demo.test');

  await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
  await page.goto('/users');

  await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible();
});
