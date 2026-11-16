import {
  hasControlCharacter,
  isCalendarDay,
  LIST_TEXT_FILTER_MAX_LENGTH,
  REGISTRATION_STATUSES,
  UUID_PATTERN,
  type RegistrationStatus,
} from '@ers/shared';
import { z } from 'zod';

import { endOfZonedDay, startOfZonedDay } from '../../../domain/zoned-day.js';

import type { DateRange } from '../../../common/pagination/list-query.js';

/** Argument shapes the tools share, described for the model. */
export const textArg = (description: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(LIST_TEXT_FILTER_MAX_LENGTH)
    .refine((text) => !hasControlCharacter(text), 'No line breaks or control characters.')
    .describe(description);
export const dayArg = (description: string) =>
  z
    .string()
    .refine(isCalendarDay, 'A real calendar day, YYYY-MM-DD.')
    .describe(`${description} Calendar day, YYYY-MM-DD.`);

/** A start range the model gave must not end before it begins, as the list endpoints require. */
function startRangeIsOrdered(args: object): boolean {
  const { startsFrom, startsTo } = args as { startsFrom?: unknown; startsTo?: unknown };
  return typeof startsFrom !== 'string' || typeof startsTo !== 'string' || startsFrom <= startsTo;
}

export const idArg = (description: string) => z.string().regex(UUID_PATTERN).describe(description);

export const registrationStatusArg = (description: string) =>
  z
    .enum(REGISTRATION_STATUSES as [RegistrationStatus, ...RegistrationStatus[]])
    .describe(description);

/** Lets the model open the matching list in the panel, with the filters of this search. */
export const showArg = z
  .boolean()
  .describe('True to open the list in the panel with the same filters, for the user to look at.')
  .optional();

/**
 * The arguments of a search over things that start on a day (`what`: "event", "session"): the
 * given fields plus a start-day range, strict, with the range in order.
 */
export function searchWithDaysArgs<TShape extends z.ZodRawShape>(shape: TShape, what: string) {
  return z
    .object({
      ...shape,
      startsFrom: dayArg(`First day the ${what} may start on.`).optional(),
      startsTo: dayArg(`Last day the ${what} may start on.`).optional(),
      show: showArg,
    })
    .strict()
    .refine(startRangeIsOrdered, 'startsTo must not be before startsFrom.');
}

/**
 * What a search covers when the model gives no day: only what starts from now on (lists that run
 * oldest first, where past items would crowd out the upcoming ones), or everything (lists that
 * already show only what is current, or where the past matters, like one's own bookings).
 */
export type WithoutDays = 'upcoming' | 'everything';

/** Days the model chose, as the moments the list endpoints filter on, in the user's zone. */
export function zonedRange(
  { startsFrom, startsTo }: { startsFrom?: string | undefined; startsTo?: string | undefined },
  timeZone: string,
  withoutDays: WithoutDays,
): DateRange | undefined {
  if (startsFrom === undefined && startsTo === undefined) {
    return withoutDays === 'upcoming' ? { gte: new Date() } : undefined;
  }
  return {
    ...(startsFrom === undefined ? {} : { gte: startOfZonedDay(startsFrom, timeZone) }),
    ...(startsTo === undefined ? {} : { lte: endOfZonedDay(startsTo, timeZone) }),
  };
}
