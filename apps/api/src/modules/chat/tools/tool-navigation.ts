import {
  CHAT_NAVIGATION,
  chatFiltersProblem,
  type ChatNavigableResource,
  type ChatNavigation,
} from '@ers/shared';

import { dayIn } from '../../../domain/zoned-day.js';

import type { WithoutDays } from './tool-filters.js';

/** A list for the panel to open, before it is tied to the question that asked for it. */
export type ListToOpen = Omit<ChatNavigation, 'id'>;

/**
 * The list filters a search's arguments stand for: every argument the list itself takes, as the
 * list's URL carries it (a flag that is on becomes "true"). Arguments the list has no filter for,
 * like `show`, are left out.
 */
function filtersFrom(resource: ChatNavigableResource, args: Record<string, unknown>) {
  const filters: Record<string, string> = {};
  for (const field of Object.keys(CHAT_NAVIGATION[resource])) {
    const value = args[field];
    if (typeof value === 'string') filters[field] = value;
    else if (value === true) filters[field] = 'true';
  }
  return filters;
}

/**
 * The list to open for a search the model asked to show, or why it cannot be opened: a filter is
 * not one the list accepts. A search that covered only what is still to come opens its list from
 * today, so the list shows what the answer talked about. Checked with the rules the panel uses.
 */
export function listToOpen(
  resource: ChatNavigableResource,
  args: Record<string, unknown>,
  { withoutDays, timeZone }: { withoutDays: WithoutDays; timeZone: string },
): ListToOpen | { problem: string } {
  const filters = filtersFrom(resource, args);
  if (
    withoutDays === 'upcoming' &&
    filters.startsFrom === undefined &&
    filters.startsTo === undefined
  ) {
    filters.startsFrom = dayIn(Date.now(), timeZone);
  }
  const problem = chatFiltersProblem(resource, filters);
  return problem === undefined ? { resource, filters } : { problem };
}
