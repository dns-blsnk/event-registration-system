import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { BANNER_WIDTH } from '../../../packages/shared/src/files.ts';

import { signIn, signOut } from './sign-in.ts';

/** A real photo of the accepted size: one of the demo banners the seed ships. */
const BANNER_FILE = fileURLToPath(
  new URL('../../api/prisma/seed/banners/workshop-series.webp', import.meta.url),
);
const DAY_MS = 86_400_000;
/** Far enough ahead that no rule about the past can get in the way, whatever day this runs. */
const DAYS_AHEAD = 30;
const SESSION_CAPACITY = '25';

/** `datetime-local` value, in the browser's (and this process's) time zone. */
function inputDateTime(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The event runs two days from 09:00; its one session takes the first morning. */
function schedule(): Record<'eventStart' | 'eventEnd' | 'sessionStart' | 'sessionEnd', string> {
  const day = new Date(Date.now() + DAYS_AHEAD * DAY_MS);
  day.setHours(9, 0, 0, 0);
  const at = (days: number, hours: number): string =>
    inputDateTime(new Date(day.getTime() + days * DAY_MS + hours * (DAY_MS / 24)));
  return {
    eventStart: at(0, 0),
    eventEnd: at(1, 9),
    sessionStart: at(0, 1),
    sessionEnd: at(0, 3),
  };
}

async function frameBanner(page: Page): Promise<void> {
  await page.getByLabel('Banner').setInputFiles(BANNER_FILE);
  const dialog = page.getByRole('dialog', { name: 'Frame the banner' });
  await dialog.getByRole('button', { name: 'Use this image' }).click();
  await expect(dialog).toBeHidden();
}

async function addSession(page: Page, times: ReturnType<typeof schedule>): Promise<void> {
  await page.getByRole('button', { name: 'Add session' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Opening keynote');
  await dialog.getByLabel(/^Starts/).fill(times.sessionStart);
  await dialog.getByLabel(/^Ends/).fill(times.sessionEnd);
  await dialog.getByRole('spinbutton', { name: 'Capacity' }).fill(SESSION_CAPACITY);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('gridcell', { name: 'Opening keynote', exact: true })).toBeVisible();
}

/**
 * The banner on the event page has loaded from storage at the stored size, so the upload went
 * through the API's re-encoding rather than being linked as picked.
 */
async function expectBannerShown(page: Page): Promise<void> {
  // Its presigned link carries the storage key, `events/<id>/banner-<uuid>`.
  const image = page.locator('img[src*="/banner-"]');
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty('naturalWidth', BANNER_WIDTH);
}

test('an organizer creates an event with a banner, adds a session and publishes it for customers', async ({
  page,
}) => {
  // The longest flow here (an upload, three saves and a second sign-in): CI machines are slower.
  test.slow();
  const title = `E2E Workshop ${randomUUID().slice(0, 8)}`;
  const times = schedule();
  await signIn(page, 'organizer@demo.test');

  await page.goto('/events/create');
  await frameBanner(page);
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('textbox', { name: 'Description' }).fill('Hands-on sessions, end to end.');
  await page.getByRole('textbox', { name: 'City' }).fill('Kyiv');
  await page.getByRole('textbox', { name: 'Venue' }).fill('Main Hall');
  await page.getByLabel(/^Starts/).fill(times.eventStart);
  await page.getByLabel(/^Ends/).fill(times.eventEnd);
  await page.getByRole('button', { name: 'Save' }).click();

  // Saved as a draft with its banner, then the event page opens.
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expectBannerShown(page);

  await addSession(page, times);
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('The event is published and open for bookings')).toBeVisible();

  // A customer now finds it in the catalog.
  await signOut(page);
  await signIn(page, 'customer@demo.test');
  await page.goto('/catalog');
  await page.getByRole('textbox', { name: 'Search' }).fill(title);
  await expect(page.getByRole('link', { name: `Open ${title}` })).toBeVisible();
});
