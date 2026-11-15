import { Action, EVENT_OWNERS_FILTER, Resource, ROLES, type UserListItem } from '@ers/shared';
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
import { enumFilter, parseListQuery } from '../../common/pagination/list-query.js';
import { sendList } from '../../common/pagination/list-result.js';

import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { toUserListItem } from './user-view.js';
import { UsersService, type UserSortField } from './users.service.js';

import type { AuthContext } from '../../common/auth/auth-context.js';
import type { Response } from 'express';

const SORTABLE: readonly UserSortField[] = ['createdAt', 'name', 'email', 'role'];

@Controller(Resource.USERS)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @RequirePermission(Resource.USERS, Action.LIST)
  @Get()
  async list(
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserListItem[]> {
    const listQuery = parseListQuery(query, {
      sortable: SORTABLE,
      defaultSort: { field: 'createdAt', direction: 'desc' },
    });
    const result = await this.users.list(listQuery, {
      role: enumFilter(query.role, 'role', ROLES),
      canOrganize:
        enumFilter(query[EVENT_OWNERS_FILTER.field], EVENT_OWNERS_FILTER.field, [
          EVENT_OWNERS_FILTER.value,
        ]) === EVENT_OWNERS_FILTER.value,
    });
    return sendList(response, { items: result.items.map(toUserListItem), total: result.total });
  }

  @RequirePermission(Resource.USERS, Action.SHOW)
  @Get(':id')
  async show(@Param('id', ParseUUIDPipe) id: string): Promise<UserListItem> {
    return toUserListItem(await this.users.get(id));
  }

  @RequirePermission(Resource.USERS, Action.CREATE)
  @Post()
  async create(@Body() dto: CreateUserDto): Promise<UserListItem> {
    return toUserListItem(await this.users.create(dto));
  }

  @RequirePermission(Resource.USERS, Action.EDIT)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<UserListItem> {
    return toUserListItem(await this.users.update(id, dto, auth.user));
  }

  @RequirePermission(Resource.USERS, Action.DELETE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<void> {
    await this.users.remove(id, auth.user);
  }
}
