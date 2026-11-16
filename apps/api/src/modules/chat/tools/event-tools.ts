import { Action, EVENT_STATUSES, Resource, type EventStatus } from '@ers/shared';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { EventsService, toEventListItem, type EventWithRelations } from '../../events/index.js';

import { TOOL_PAGE_SIZE, type AssistantTool, type ToolContext } from './assistant-tool.js';
import {
  dayArg,
  idArg,
  START_RANGE_MESSAGE,
  startRangeIsOrdered,
  textArg,
  zonedRange,
} from './tool-filters.js';

/** The longest event description the model gets; the start says what it is about. */
const DESCRIPTION_MAX_LENGTH = 500;

/** What the model needs to answer about an event: no ids it cannot use, no internal fields. */
function eventSummary(event: EventWithRelations) {
  const item = toEventListItem(event);
  return {
    id: item.id,
    title: item.title,
    city: item.city,
    venue: item.venue,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    status: item.status,
    organizer: item.organizer.name,
    tags: item.tags.map((tag) => tag.name),
    seats: { total: item.capacity, taken: item.confirmedCount },
  };
}

const searchEventsArgs = z
  .object({
    q: textArg('Words from the title or venue.').optional(),
    city: textArg('Part of the city name, in English spelling, e.g. "Tallinn".').optional(),
    status: z
      .enum(EVENT_STATUSES as [EventStatus, ...EventStatus[]])
      .describe('Only events in this status.')
      .optional(),
    tagId: idArg('Only events with this tag, an id from list_tags.').optional(),
    startsFrom: dayArg('First day the event may start on.').optional(),
    startsTo: dayArg('Last day the event may start on.').optional(),
  })
  .strict()
  .refine(startRangeIsOrdered, START_RANGE_MESSAGE);

@Injectable()
export class SearchEventsTool implements AssistantTool<typeof searchEventsArgs> {
  readonly name = 'search_events';
  readonly description = `Search the events the user may see. All filters are optional and combined. Without days, only upcoming events; give days to look back. Returns at most ${String(TOOL_PAGE_SIZE)}, soonest first, and the total count.`;
  readonly parameters = searchEventsArgs;
  readonly permission = { resource: Resource.EVENTS, action: Action.LIST };

  constructor(private readonly events: EventsService) {}

  async run(args: z.infer<typeof searchEventsArgs>, { user, timeZone }: ToolContext) {
    const result = await this.events.list(
      {
        skip: 0,
        take: TOOL_PAGE_SIZE,
        sort: [{ field: 'startsAt', direction: 'asc' }],
        search: args.q,
      },
      {
        status: args.status,
        city: args.city,
        tagId: args.tagId,
        startsAt: zonedRange(args.startsFrom, args.startsTo, timeZone),
      },
      user,
    );
    return { total: result.total, events: result.items.map(eventSummary) };
  }
}

const getEventArgs = z.object({ id: idArg('The event id, from search_events.') }).strict();

@Injectable()
export class GetEventTool implements AssistantTool<typeof getEventArgs> {
  readonly name = 'get_event';
  readonly description = 'One event the user may see, with its description.';
  readonly parameters = getEventArgs;
  readonly permission = { resource: Resource.EVENTS, action: Action.SHOW };

  constructor(private readonly events: EventsService) {}

  async run({ id }: z.infer<typeof getEventArgs>, { user }: ToolContext) {
    const event = await this.events.get(id, user);
    return {
      ...eventSummary(event),
      description: event.description.slice(0, DESCRIPTION_MAX_LENGTH),
    };
  }
}
