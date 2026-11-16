import {
  Action,
  REGISTRATION_STATUSES,
  Resource,
  type BulkStatusResponse,
  type RegistrationListItem,
} from '@ers/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';

import { RequirePermission } from '../../common/auth/access.decorator.js';
import { CurrentAuth } from '../../common/auth/current-user.decorator.js';
import { enumFilter, parseListQuery, uuidFilter } from '../../common/pagination/list-query.js';
import { sendList } from '../../common/pagination/list-result.js';

import { BulkStatusDto } from './dto/bulk-status.dto.js';
import { RegistrationStatusService } from './registration-status.service.js';
import { toRegistrationListItem } from './registration-view.js';
import {
  RegistrationsService,
  type RegistrationFilters,
  type RegistrationSortField,
} from './registrations.service.js';

import type { AuthContext } from '../../common/auth/auth-context.js';
import type { Response } from 'express';

const SORTABLE: readonly RegistrationSortField[] = ['createdAt', 'status'];

function filtersOf(query: Record<string, unknown>): RegistrationFilters {
  return {
    status: enumFilter(query.status, 'status', REGISTRATION_STATUSES),
    sessionId: uuidFilter(query.sessionId, 'sessionId'),
    eventId: uuidFilter(query.eventId, 'eventId'),
    customerId: uuidFilter(query.customerId, 'customerId'),
  };
}

/** Registrations as staff see them: admins everything, organizers their own events. */
@Controller(Resource.REGISTRATIONS)
export class RegistrationsController {
  constructor(
    private readonly registrations: RegistrationsService,
    private readonly statuses: RegistrationStatusService,
  ) {}

  @RequirePermission(Resource.REGISTRATIONS, Action.LIST)
  @Get()
  async list(
    @Query() query: Record<string, unknown>,
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RegistrationListItem[]> {
    const listQuery = parseListQuery(query, {
      sortable: SORTABLE,
      defaultSort: { field: 'createdAt', direction: 'desc' },
    });
    const result = await this.registrations.list(listQuery, filtersOf(query), auth.user);
    return sendList(response, {
      items: result.items.map(toRegistrationListItem),
      total: result.total,
    });
  }

  @RequirePermission(Resource.REGISTRATIONS, Action.BULK_STATUS)
  @Post('bulk-status')
  @HttpCode(HttpStatus.OK)
  async bulkStatus(
    @Body() dto: BulkStatusDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<BulkStatusResponse> {
    return { results: await this.statuses.bulkChange(dto.ids, dto.status, auth.user) };
  }

  @RequirePermission(Resource.REGISTRATIONS, Action.SHOW)
  @Get(':id')
  async show(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<RegistrationListItem> {
    return toRegistrationListItem(await this.registrations.get(id, auth.user));
  }
}
