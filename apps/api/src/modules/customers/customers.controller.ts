import { Action, Resource, type CustomerListItem } from '@ers/shared';
import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';

import { RequirePermission } from '../../common/auth/access.decorator.js';
import { CurrentAuth } from '../../common/auth/current-user.decorator.js';
import { parseListQuery } from '../../common/pagination/list-query.js';
import { sendList } from '../../common/pagination/list-result.js';

import { CustomersService, type CustomerSortField } from './customers.service.js';

import type { AuthContext } from '../../common/auth/auth-context.js';
import type { Response } from 'express';

const SORTABLE: readonly CustomerSortField[] = ['name', 'email', 'createdAt', 'registrationCount'];

/** Read-only view of customers for staff. */
@Controller(Resource.CUSTOMERS)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @RequirePermission(Resource.CUSTOMERS, Action.LIST)
  @Get()
  async list(
    @Query() query: Record<string, unknown>,
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CustomerListItem[]> {
    const listQuery = parseListQuery(query, {
      sortable: SORTABLE,
      defaultSort: { field: 'name', direction: 'asc' },
    });
    return sendList(response, await this.customers.list(listQuery, auth.user));
  }

  @RequirePermission(Resource.CUSTOMERS, Action.SHOW)
  @Get(':id')
  async show(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<CustomerListItem> {
    return this.customers.get(id, auth.user);
  }
}
