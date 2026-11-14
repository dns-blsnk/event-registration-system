import {
  Action,
  EVENT_STATUSES,
  Resource,
  type EventDetail,
  type EventListItem,
} from '@ers/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';

import { RequirePermission } from '../../common/auth/access.decorator.js';
import { CurrentAuth } from '../../common/auth/current-user.decorator.js';
import {
  dateRangeFilter,
  enumFilter,
  parseListQuery,
  textFilter,
  uuidFilter,
} from '../../common/pagination/list-query.js';
import { sendList } from '../../common/pagination/list-result.js';

import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { EventBannerService } from './event-banner.service.js';
import { EventLifecycleService } from './event-lifecycle.service.js';
import { toEventDetail, toEventListItem, type EventWithRelations } from './event-view.js';
import { EventsService, type EventFilters, type EventSortField } from './events.service.js';

import type { AuthContext } from '../../common/auth/auth-context.js';
import type { Response } from 'express';

const SORTABLE: readonly EventSortField[] = ['startsAt', 'title', 'city', 'status', 'createdAt'];

function filtersOf(query: Record<string, unknown>): EventFilters {
  return {
    status: enumFilter(query.status, 'status', EVENT_STATUSES),
    city: textFilter(query.city, 'city'),
    tagId: uuidFilter(query.tagId, 'tagId'),
    organizerId: uuidFilter(query.organizerId, 'organizerId'),
    startsAt: dateRangeFilter(query, 'startsFrom', 'startsTo'),
  };
}

@Controller(Resource.EVENTS)
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly lifecycle: EventLifecycleService,
    private readonly banners: EventBannerService,
  ) {}

  @RequirePermission(Resource.EVENTS, Action.LIST)
  @Get()
  async list(
    @Query() query: Record<string, unknown>,
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<EventListItem[]> {
    const listQuery = parseListQuery(query, {
      sortable: SORTABLE,
      defaultSort: { field: 'startsAt', direction: 'asc' },
    });
    const result = await this.events.list(listQuery, filtersOf(query), auth.user);
    return sendList(response, { items: result.items.map(toEventListItem), total: result.total });
  }

  @RequirePermission(Resource.EVENTS, Action.SHOW)
  @Get(':id')
  async show(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<EventDetail> {
    return this.detail(await this.events.get(id, auth.user));
  }

  @RequirePermission(Resource.EVENTS, Action.CREATE)
  @Post()
  async create(
    @Body() dto: CreateEventDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<EventDetail> {
    return this.detail(await this.events.create(dto, auth.user));
  }

  @RequirePermission(Resource.EVENTS, Action.EDIT)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<EventDetail> {
    return this.detail(await this.events.update(id, dto, auth.user));
  }

  @RequirePermission(Resource.EVENTS, Action.PUBLISH)
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<EventDetail> {
    return this.detail(await this.lifecycle.publish(id, auth.user));
  }

  @RequirePermission(Resource.EVENTS, Action.COMPLETE)
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<EventDetail> {
    return this.detail(await this.lifecycle.complete(id, auth.user));
  }

  @RequirePermission(Resource.EVENTS, Action.CANCEL)
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<EventDetail> {
    return this.detail(await this.lifecycle.cancel(id, auth.user));
  }

  @RequirePermission(Resource.EVENTS, Action.DELETE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<void> {
    await this.lifecycle.remove(id, auth.user);
  }

  private async detail(event: EventWithRelations): Promise<EventDetail> {
    return toEventDetail(event, await this.banners.urlOf(event.bannerKey));
  }
}
