import { isCalendarDay } from '@ers/shared';

import { HOUR_MS } from '../common/time.js';

/** No zone is more than 14 hours from UTC, so a day starts within this distance of UTC midnight. */
const MAX_ZONE_OFFSET_HOURS = 15;
const MAX_ZONE_OFFSET_MS = MAX_ZONE_OFFSET_HOURS * HOUR_MS;
/** Far enough past a day's start to be inside the next day in any zone. */
const INTO_NEXT_DAY_MS = MAX_ZONE_OFFSET_MS + MAX_ZONE_OFFSET_MS;
/** Bisection splits the remaining interval in two. */
const HALVES = 2;

/** The calendar day an instant falls on in a zone, as YYYY-MM-DD (comparable as text). */
export function dayIn(instant: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * The first moment of a calendar day (YYYY-MM-DD) in a time zone, found by bisection: the first
 * instant whose local date is that day. Exact even where a daylight-saving change skips midnight.
 */
export function startOfZonedDay(day: string, timeZone: string): Date {
  if (!isCalendarDay(day)) throw new RangeError(`Not a calendar day: ${day}`);
  const midnightUtc = Date.parse(`${day}T00:00:00Z`);
  let before = midnightUtc - MAX_ZONE_OFFSET_MS;
  let atOrAfter = midnightUtc + MAX_ZONE_OFFSET_MS;
  while (atOrAfter - before > 1) {
    const middle = before + Math.floor((atOrAfter - before) / HALVES);
    if (dayIn(middle, timeZone) >= day) atOrAfter = middle;
    else before = middle;
  }
  return new Date(atOrAfter);
}

/** The last moment of a calendar day in a time zone: just before the next day starts. */
export function endOfZonedDay(day: string, timeZone: string): Date {
  const start = startOfZonedDay(day, timeZone).getTime();
  // Some instant of the next local day, then that day's own start.
  const nextDay = dayIn(start + INTO_NEXT_DAY_MS, timeZone);
  return new Date(startOfZonedDay(nextDay, timeZone).getTime() - 1);
}
