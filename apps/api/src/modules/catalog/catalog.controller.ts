import { Action, Resource, type CatalogEventDetail, type CatalogEventListItem } from '@ers/shared';
import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';

import { RequirePermission } from '../../common/auth/access.decorator.js';
import { CurrentAuth } from '../../common/auth/current-user.decorator.js';
import {
  dateRangeFilter,
  parseListQuery,
  textFilter,
  uuidFilter,
} from '../../common/pagination/list-query.js';
import { sendList } from '../../common/pagination/list-result.js';

import { CatalogService, type CatalogFilters, type CatalogSortField } from './catalog.service.js';

import type { AuthContext } from '../../common/auth/auth-context.js';
import type { Response } from 'express';

const SORTABLE: readonly CatalogSortField[] = ['startsAt', 'title'];

function filtersOf(query: Record<string, unknown>): CatalogFilters {
  return {
    city: textFilter(query.city, 'city'),
    tagId: uuidFilter(query.tagId, 'tagId'),
    startsAt: dateRangeFilter(query, 'startsFrom', 'startsTo'),
  };
}

/** The customer's view of events: published and not yet over, read-only. */
@Controller(Resource.CATALOG)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @RequirePermission(Resource.CATALOG, Action.LIST)
  @Get()
  async list(
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CatalogEventListItem[]> {
    const listQuery = parseListQuery(query, {
      sortable: SORTABLE,
      defaultSort: { field: 'startsAt', direction: 'asc' },
    });
    return sendList(response, await this.catalog.list(listQuery, filtersOf(query)));
  }

  @RequirePermission(Resource.CATALOG, Action.SHOW)
  @Get(':id')
  async show(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<CatalogEventDetail> {
    return this.catalog.get(id, auth.user.id);
  }
}
