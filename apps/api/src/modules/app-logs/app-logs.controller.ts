import {
  Action,
  AppLogCategory,
  AppLogLevel,
  Resource,
  type AppLogDetail,
  type AppLogListItem,
} from '@ers/shared';
import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';

import { RequirePermission } from '../../common/auth/access.decorator.js';
import {
  dateRangeFilter,
  enumFilter,
  integerFilter,
  parseListQuery,
  textFilter,
} from '../../common/pagination/list-query.js';
import { sendList } from '../../common/pagination/list-result.js';

import { toAppLogDetail, toAppLogListItem } from './app-log-view.js';
import {
  AppLogsReadService,
  type AppLogFilters,
  type AppLogSortField,
} from './app-logs-read.service.js';

import type { Response } from 'express';

const SORTABLE: readonly AppLogSortField[] = ['createdAt'];
const HTTP_STATUS_RANGE = { min: 100, max: 599 };

function filtersOf(query: Record<string, unknown>): AppLogFilters {
  return {
    level: enumFilter(query.level, 'level', Object.values(AppLogLevel)),
    category: enumFilter(query.category, 'category', Object.values(AppLogCategory)),
    statusCode: integerFilter(query.statusCode, 'statusCode', HTTP_STATUS_RANGE),
    requestId: textFilter(query.requestId, 'requestId'),
    createdAt: dateRangeFilter(query, 'from', 'to'),
  };
}

/**
 * Read-only journal for admins: find the entry behind an error a user saw by its requestId
 * (every error body carries one) and read why it happened.
 */
@Controller(Resource.APP_LOGS)
export class AppLogsController {
  constructor(private readonly logs: AppLogsReadService) {}

  @RequirePermission(Resource.APP_LOGS, Action.LIST)
  @Get()
  async list(
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AppLogListItem[]> {
    const listQuery = parseListQuery(query, {
      sortable: SORTABLE,
      defaultSort: { field: 'createdAt', direction: 'desc' },
    });
    const result = await this.logs.list(listQuery, filtersOf(query));
    return sendList(response, { items: result.items.map(toAppLogListItem), total: result.total });
  }

  @RequirePermission(Resource.APP_LOGS, Action.SHOW)
  @Get(':id')
  async show(@Param('id', ParseUUIDPipe) id: string): Promise<AppLogDetail> {
    return toAppLogDetail(await this.logs.get(id));
  }
}
