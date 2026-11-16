import {
  Action,
  ErrorCode,
  REGISTRATION_STATUSES,
  Resource,
  type MyRegistration,
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
import { DomainError } from '../../common/errors/domain-error.js';
import { dateRangeFilter, enumFilter, parseListQuery } from '../../common/pagination/list-query.js';
import { sendList } from '../../common/pagination/list-result.js';

import { BookingService } from './booking.service.js';
import { BookDto } from './dto/book.dto.js';
import {
  MyRegistrationsService,
  type MyRegistrationSortField,
} from './my-registrations.service.js';

import type { AuthContext } from '../../common/auth/auth-context.js';
import type { Response } from 'express';

const SORTABLE: readonly MyRegistrationSortField[] = ['createdAt'];

/** The customer's own bookings. Every query is limited to the signed-in customer. */
@Controller(Resource.MY_REGISTRATIONS)
export class MyRegistrationsController {
  constructor(
    private readonly booking: BookingService,
    private readonly registrations: MyRegistrationsService,
  ) {}

  @RequirePermission(Resource.MY_REGISTRATIONS, Action.LIST)
  @Get()
  async list(
    @Query() query: Record<string, unknown>,
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MyRegistration[]> {
    const listQuery = parseListQuery(query, {
      sortable: SORTABLE,
      defaultSort: { field: 'createdAt', direction: 'desc' },
    });
    const filters = {
      status: enumFilter(query.status, 'status', REGISTRATION_STATUSES),
      startsAt: dateRangeFilter(query, 'startsFrom', 'startsTo'),
    };
    return sendList(response, await this.registrations.list(auth.user.id, listQuery, filters));
  }

  @RequirePermission(Resource.MY_REGISTRATIONS, Action.SHOW)
  @Get(':id')
  async show(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<MyRegistration> {
    return this.mine(auth.user.id, id);
  }

  @RequirePermission(Resource.MY_REGISTRATIONS, Action.CREATE)
  @Post()
  async book(@Body() dto: BookDto, @CurrentAuth() auth: AuthContext): Promise<MyRegistration> {
    const registration = await this.booking.book(dto.sessionId, auth.user.id);
    return this.mine(auth.user.id, registration.id);
  }

  @RequirePermission(Resource.MY_REGISTRATIONS, Action.CANCEL)
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<MyRegistration> {
    await this.booking.cancel(id, { scope: { customerId: auth.user.id }, byStaff: false });
    return this.mine(auth.user.id, id);
  }

  private async mine(customerId: string, id: string): Promise<MyRegistration> {
    const registration = await this.registrations.get(customerId, id);
    if (registration === null) {
      throw new DomainError(ErrorCode.NOT_FOUND, 'Registration not found');
    }
    return registration;
  }
}
