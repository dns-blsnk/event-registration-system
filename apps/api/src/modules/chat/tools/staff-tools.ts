import { Action, Resource } from '@ers/shared';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { CustomersService } from '../../customers/index.js';
import {
  RegistrationsService,
  toRegistrationListItem,
  type RegistrationWithRelations,
} from '../../registrations/index.js';
import {
  SessionsService,
  toSessionListItem,
  type SessionWithRelations,
} from '../../sessions/index.js';
import { TagsService } from '../../tags/index.js';

import {
  TOOL_PAGE_SIZE,
  UP_TO_A_PAGE,
  type AssistantTool,
  type ToolContext,
} from './assistant-tool.js';
import {
  idArg,
  registrationStatusArg,
  searchWithDaysArgs,
  showArg,
  textArg,
  zonedRange,
} from './tool-filters.js';

/** Seats and the waitlist of a session, as the model needs them to answer. */
function sessionSummary(session: SessionWithRelations) {
  const item = toSessionListItem(session);
  return {
    id: item.id,
    title: item.title,
    event: { id: item.eventId, title: item.eventTitle },
    speaker: item.speaker,
    room: item.room,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    seats: { total: item.capacity, taken: item.confirmedCount, left: item.seatsLeft },
    waitlist: item.waitlistCount,
  };
}

const searchSessionsArgs = searchWithDaysArgs(
  {
    q: textArg('Words from the title, speaker or room.').optional(),
    eventId: idArg('Only sessions of this event, an id from search_events.').optional(),
    almostFull: z.boolean().describe('Only sessions with most seats taken.').optional(),
  },
  'session',
);

@Injectable()
export class SearchSessionsTool implements AssistantTool<typeof searchSessionsArgs> {
  readonly name = 'search_sessions';
  readonly description = `Search the sessions (talks, workshops) the user may see, soonest first. Without days, only upcoming sessions; give days to look back. ${UP_TO_A_PAGE}`;
  readonly parameters = searchSessionsArgs;
  readonly permission = { resource: Resource.SESSIONS, action: Action.LIST };
  readonly listView = { withoutDays: 'upcoming' } as const;

  constructor(private readonly sessions: SessionsService) {}

  async run(args: z.infer<typeof searchSessionsArgs>, { user, timeZone }: ToolContext) {
    const result = await this.sessions.list(
      {
        skip: 0,
        take: TOOL_PAGE_SIZE,
        sort: [{ field: 'startsAt', direction: 'asc' }],
        search: args.q,
      },
      {
        eventId: args.eventId,
        almostFull: args.almostFull,
        startsAt: zonedRange(args, timeZone, this.listView.withoutDays),
      },
      user,
    );
    return { total: result.total, sessions: result.items.map(sessionSummary) };
  }
}

/**
 * A booking without the customer's email: the model is an outside service, and the name with the
 * id is enough to narrow a search; staff see the email on the list itself.
 */
function registrationSummary(row: RegistrationWithRelations) {
  const { customer, ...item } = toRegistrationListItem(row);
  return { ...item, customer: { id: customer.id, name: customer.name } };
}

const searchRegistrationsArgs = z
  .object({
    q: textArg("Part of the customer's name or email.").optional(),
    status: registrationStatusArg('Only bookings in this status.').optional(),
    eventId: idArg('Only bookings for this event.').optional(),
    sessionId: idArg('Only bookings for this session.').optional(),
    customerId: idArg('Only bookings of this customer, an id from search_customers.').optional(),
    show: showArg,
  })
  .strict();

@Injectable()
export class SearchRegistrationsTool implements AssistantTool<typeof searchRegistrationsArgs> {
  readonly name = 'search_registrations';
  readonly description = `Search bookings of sessions the user may see, newest first. ${UP_TO_A_PAGE}`;
  readonly parameters = searchRegistrationsArgs;
  readonly permission = { resource: Resource.REGISTRATIONS, action: Action.LIST };
  readonly listView = { withoutDays: 'everything' } as const;

  constructor(private readonly registrations: RegistrationsService) {}

  async run(args: z.infer<typeof searchRegistrationsArgs>, { user }: ToolContext) {
    const result = await this.registrations.list(
      {
        skip: 0,
        take: TOOL_PAGE_SIZE,
        sort: [{ field: 'createdAt', direction: 'desc' }],
        search: args.q,
      },
      {
        status: args.status,
        eventId: args.eventId,
        sessionId: args.sessionId,
        customerId: args.customerId,
      },
      user,
    );
    return { total: result.total, registrations: result.items.map(registrationSummary) };
  }
}

const searchCustomersArgs = z
  .object({ q: textArg("Part of the customer's name or email.").optional(), show: showArg })
  .strict();

@Injectable()
export class SearchCustomersTool implements AssistantTool<typeof searchCustomersArgs> {
  readonly name = 'search_customers';
  readonly description = `Search the customers the user may see, by name or email; returns names, not emails. ${UP_TO_A_PAGE}`;
  readonly parameters = searchCustomersArgs;
  readonly permission = { resource: Resource.CUSTOMERS, action: Action.LIST };
  readonly listView = { withoutDays: 'everything' } as const;

  constructor(private readonly customers: CustomersService) {}

  async run(args: z.infer<typeof searchCustomersArgs>, { user }: ToolContext) {
    const result = await this.customers.list(
      {
        skip: 0,
        take: TOOL_PAGE_SIZE,
        sort: [{ field: 'name', direction: 'asc' }],
        search: args.q,
      },
      user,
    );
    return {
      total: result.total,
      customers: result.items.map(({ id, name, registrationCount }) => ({
        id,
        name,
        bookings: registrationCount,
      })),
    };
  }
}

const listTagsArgs = z.object({ q: textArg('Part of the tag name.').optional() }).strict();

@Injectable()
export class ListTagsTool implements AssistantTool<typeof listTagsArgs> {
  readonly name = 'list_tags';
  readonly description = `Event tags with their ids, to filter search_events by tag. ${UP_TO_A_PAGE}`;
  readonly parameters = listTagsArgs;
  readonly permission = { resource: Resource.TAGS, action: Action.LIST };

  constructor(private readonly tags: TagsService) {}

  async run(args: z.infer<typeof listTagsArgs>) {
    const result = await this.tags.list({
      skip: 0,
      take: TOOL_PAGE_SIZE,
      sort: [{ field: 'name', direction: 'asc' }],
      search: args.q,
    });
    return {
      total: result.total,
      // No event counts: they include other organizers' events, drafts too.
      tags: result.items.map(({ id, name }) => ({ id, name })),
    };
  }
}
