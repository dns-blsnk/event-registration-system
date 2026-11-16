import { Action, Resource } from '@ers/shared';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { CatalogService } from '../../catalog/index.js';
import { MyRegistrationsService } from '../../registrations/index.js';

import {
  TOOL_PAGE_SIZE,
  UP_TO_A_PAGE,
  type AssistantTool,
  type ToolContext,
} from './assistant-tool.js';
import { registrationStatusArg, searchWithDaysArgs, textArg, zonedRange } from './tool-filters.js';

const searchCatalogArgs = searchWithDaysArgs(
  {
    q: textArg('Words from the title or venue.').optional(),
    city: textArg('Part of the city name, in English spelling, e.g. "Tallinn".').optional(),
  },
  'event',
);

/** The public catalog: published events that have not ended, the same for every customer. */
@Injectable()
export class SearchCatalogTool implements AssistantTool<typeof searchCatalogArgs> {
  readonly name = 'search_catalog';
  readonly description = `Search the events open for booking, soonest first, with seats left in their upcoming sessions. ${UP_TO_A_PAGE}`;
  readonly parameters = searchCatalogArgs;
  readonly permission = { resource: Resource.CATALOG, action: Action.LIST };

  constructor(private readonly catalog: CatalogService) {}

  async run(args: z.infer<typeof searchCatalogArgs>, { timeZone }: ToolContext) {
    const result = await this.catalog.list(
      {
        skip: 0,
        take: TOOL_PAGE_SIZE,
        sort: [{ field: 'startsAt', direction: 'asc' }],
        search: args.q,
      },
      // The catalog already shows only events that have not ended, ongoing ones included.
      { city: args.city, startsAt: zonedRange(args, timeZone, 'everything') },
    );
    return {
      total: result.total,
      events: result.items.map(({ tags, ...event }) => ({
        ...event,
        tags: tags.map((tag) => tag.name),
      })),
    };
  }
}

const searchMyRegistrationsArgs = searchWithDaysArgs(
  {
    q: textArg('Words from the event or session title.').optional(),
    status: registrationStatusArg('Only bookings in this status.').optional(),
  },
  'session',
);

/** The customer's own bookings, past ones included: "my booking for the React workshop". */
@Injectable()
export class SearchMyRegistrationsTool implements AssistantTool<typeof searchMyRegistrationsArgs> {
  readonly name = 'search_my_registrations';
  readonly description = `Search the user's own bookings, newest first, with their place on the waitlist. ${UP_TO_A_PAGE}`;
  readonly parameters = searchMyRegistrationsArgs;
  readonly permission = { resource: Resource.MY_REGISTRATIONS, action: Action.LIST };

  constructor(private readonly registrations: MyRegistrationsService) {}

  async run(args: z.infer<typeof searchMyRegistrationsArgs>, { user, timeZone }: ToolContext) {
    const result = await this.registrations.list(
      user.id,
      {
        skip: 0,
        take: TOOL_PAGE_SIZE,
        sort: [{ field: 'createdAt', direction: 'desc' }],
        search: args.q,
      },
      {
        status: args.status,
        startsAt: zonedRange(args, timeZone, 'everything'),
      },
    );
    return { total: result.total, registrations: result.items };
  }
}
