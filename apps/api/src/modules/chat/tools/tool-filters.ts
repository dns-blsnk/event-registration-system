import {
  hasControlCharacter,
  isCalendarDay,
  LIST_TEXT_FILTER_MAX_LENGTH,
  UUID_PATTERN,
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
export function startRangeIsOrdered(args: {
  startsFrom?: string | undefined;
  startsTo?: string | undefined;
}): boolean {
  return (
    args.startsFrom === undefined || args.startsTo === undefined || args.startsFrom <= args.startsTo
  );
}
export const START_RANGE_MESSAGE = 'startsTo must not be before startsFrom.';
export const idArg = (description: string) => z.string().regex(UUID_PATTERN).describe(description);

/** Days the model chose, as the moments the list endpoints filter on, in the user's zone. */
export function zonedRange(
  startsFrom: string | undefined,
  startsTo: string | undefined,
  timeZone: string,
): DateRange | undefined {
  if (startsFrom === undefined && startsTo === undefined) return undefined;
  return {
    ...(startsFrom === undefined ? {} : { gte: startOfZonedDay(startsFrom, timeZone) }),
    ...(startsTo === undefined ? {} : { lte: endOfZonedDay(startsTo, timeZone) }),
  };
}
