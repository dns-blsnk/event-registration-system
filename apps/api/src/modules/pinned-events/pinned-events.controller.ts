import { Action, PINNED_EVENTS_PATH, Resource, type EventListItem } from '@ers/shared';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Res,
} from '@nestjs/common';

import { RequirePermission } from '../../common/auth/access.decorator.js';
import { CurrentAuth } from '../../common/auth/current-user.decorator.js';
import { sendList } from '../../common/pagination/list-result.js';
import { toEventListItem } from '../events/index.js';

import { PinnedEventsService } from './pinned-events.service.js';

import type { AuthContext } from '../../common/auth/auth-context.js';
import type { Response } from 'express';

/**
 * The signed-in staff member's pinned events. A pin is a personal bookmark over the events list,
 * so it takes the events list permission (and the service limits it to visible events) rather
 * than a matrix entry of its own: it has no screen, menu item or form like the other resources.
 */
@Controller(PINNED_EVENTS_PATH)
export class PinnedEventsController {
  constructor(private readonly pins: PinnedEventsService) {}

  @RequirePermission(Resource.EVENTS, Action.LIST)
  @Get()
  async list(
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<EventListItem[]> {
    const events = await this.pins.list(auth.user);
    return sendList(response, { items: events.map(toEventListItem), total: events.length });
  }

  @RequirePermission(Resource.EVENTS, Action.LIST)
  @Put(':eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async pin(
    @CurrentAuth() auth: AuthContext,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<void> {
    await this.pins.pin(auth.user, eventId);
  }

  @RequirePermission(Resource.EVENTS, Action.LIST)
  @Delete(':eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unpin(
    @CurrentAuth() auth: AuthContext,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<void> {
    await this.pins.unpin(auth.user, eventId);
  }
}
