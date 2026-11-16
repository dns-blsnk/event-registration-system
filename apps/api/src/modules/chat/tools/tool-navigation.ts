import {
  CHAT_NAVIGATION,
  chatFiltersProblem,
  isChatNavigableResource,
  type ChatNavigableResource,
  type ChatNavigation,
} from '@ers/shared';

import { dayIn } from '../../../domain/zoned-day.js';
import { isRecord, parseJson } from '../json.js';

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

/** Where a tool's reply to the model keeps the list it opened, so the chat can show it again. */
export const OPENED_LIST_FIELD = 'openedList';

/** The kept list, if it is still one the list rules accept; a kept value is never trusted. */
function toCheckedList(value: unknown): ListToOpen | undefined {
  if (!isRecord(value) || !isRecord(value.filters)) return undefined;
  const { resource, filters } = value;
  if (typeof resource !== 'string' || !isChatNavigableResource(resource)) return undefined;
  if (chatFiltersProblem(resource, filters) !== undefined) return undefined;
  const entries = Object.entries(filters).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return { resource, filters: Object.fromEntries(entries) };
}

/** The list a tool's reply says it opened, or undefined when it opened none. */
export function readOpenedList(reply: unknown): ListToOpen | undefined {
  if (typeof reply !== 'string') return undefined;
  const value = parseJson(reply);
  return isRecord(value) ? toCheckedList(value[OPENED_LIST_FIELD]) : undefined;
}
