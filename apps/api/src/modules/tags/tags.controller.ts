import { Action, Resource, type TagListItem } from '@ers/shared';
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
import { parseListQuery } from '../../common/pagination/list-query.js';
import { sendList } from '../../common/pagination/list-result.js';

import { TagDto } from './dto/tag.dto.js';
import { TagsService, type TagSortField } from './tags.service.js';

import type { Response } from 'express';

const SORTABLE: readonly TagSortField[] = ['name', 'eventCount'];

/** Tags are global: staff read them to label events, only admins manage them. */
@Controller(Resource.TAGS)
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @RequirePermission(Resource.TAGS, Action.LIST)
  @Get()
  async list(
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TagListItem[]> {
    const listQuery = parseListQuery(query, {
      sortable: SORTABLE,
      defaultSort: { field: 'name', direction: 'asc' },
    });
    return sendList(response, await this.tags.list(listQuery));
  }

  @RequirePermission(Resource.TAGS, Action.SHOW)
  @Get(':id')
  async show(@Param('id', ParseUUIDPipe) id: string): Promise<TagListItem> {
    return this.tags.get(id);
  }

  @RequirePermission(Resource.TAGS, Action.CREATE)
  @Post()
  async create(@Body() dto: TagDto): Promise<TagListItem> {
    return this.tags.create(dto);
  }

  @RequirePermission(Resource.TAGS, Action.EDIT)
  @Patch(':id')
  async rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TagDto): Promise<TagListItem> {
    return this.tags.rename(id, dto);
  }

  @RequirePermission(Resource.TAGS, Action.DELETE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.tags.remove(id);
  }
}
