import { Action, Resource, type SessionListItem } from '@ers/shared';
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
  uuidFilter,
} from '../../common/pagination/list-query.js';
import { sendList } from '../../common/pagination/list-result.js';

import { CreateSessionDto } from './dto/create-session.dto.js';
import { UpdateSessionDto } from './dto/update-session.dto.js';
import { toSessionListItem } from './session-view.js';
import { SessionsService, type SessionFilters, type SessionSortField } from './sessions.service.js';

import type { AuthContext } from '../../common/auth/auth-context.js';
import type { Response } from 'express';

const SORTABLE: readonly SessionSortField[] = ['startsAt', 'title', 'capacity', 'confirmedCount'];

function filtersOf(query: Record<string, unknown>): SessionFilters {
  return {
    eventId: uuidFilter(query.eventId, 'eventId'),
    almostFull: enumFilter(query.almostFull, 'almostFull', ['true']) === 'true',
    startsAt: dateRangeFilter(query, 'startsFrom', 'startsTo'),
  };
}

@Controller(Resource.SESSIONS)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @RequirePermission(Resource.SESSIONS, Action.LIST)
  @Get()
  async list(
    @Query() query: Record<string, unknown>,
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionListItem[]> {
    const listQuery = parseListQuery(query, {
      sortable: SORTABLE,
      defaultSort: { field: 'startsAt', direction: 'asc' },
    });
    const result = await this.sessions.list(listQuery, filtersOf(query), auth.user);
    return sendList(response, { items: result.items.map(toSessionListItem), total: result.total });
  }

  @RequirePermission(Resource.SESSIONS, Action.SHOW)
  @Get(':id')
  async show(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<SessionListItem> {
    return toSessionListItem(await this.sessions.get(id, auth.user));
  }

  @RequirePermission(Resource.SESSIONS, Action.CREATE)
  @Post()
  async create(
    @Body() dto: CreateSessionDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<SessionListItem> {
    return toSessionListItem(await this.sessions.create(dto, auth.user));
  }

  @RequirePermission(Resource.SESSIONS, Action.EDIT)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessionDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<SessionListItem> {
    return toSessionListItem(await this.sessions.update(id, dto, auth.user));
  }

  @RequirePermission(Resource.SESSIONS, Action.DELETE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<void> {
    await this.sessions.remove(id, auth.user);
  }
}
