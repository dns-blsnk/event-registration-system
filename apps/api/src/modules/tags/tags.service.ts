import { ErrorCode, type TagListItem } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import { PrismaErrorCode, prismaErrorCode } from '../../common/errors/prisma-errors.js';
import { orderByOf, type ListQuery } from '../../common/pagination/list-query.js';
import { containsInsensitive } from '../../common/pagination/search.js';
import { PrismaService } from '../../prisma/prisma.service.js';

import type { ListResult } from '../../common/pagination/list-result.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { TagDto } from './dto/tag.dto.js';

export type TagSortField = 'name' | 'eventCount';

const TAG_SELECT = {
  id: true,
  name: true,
  _count: { select: { events: true } },
} satisfies Prisma.TagSelect;
type TagRow = Prisma.TagGetPayload<{ select: typeof TAG_SELECT }>;

const NOT_FOUND_MESSAGE = 'Tag not found';

function toTagListItem(row: TagRow): TagListItem {
  return { id: row.id, name: row.name, eventCount: row._count.events };
}

/** Tag names are unique ignoring case (a database index enforces it). */
@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListQuery<TagSortField>): Promise<ListResult<TagListItem>> {
    const where: Prisma.TagWhereInput =
      query.search === undefined ? {} : { name: containsInsensitive(query.search) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tag.findMany({
        where,
        select: TAG_SELECT,
        orderBy: orderByOf(query, (field, direction) =>
          field === 'eventCount' ? { events: { _count: direction } } : undefined,
        ),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.tag.count({ where }),
    ]);
    return { items: rows.map(toTagListItem), total };
  }

  async get(id: string): Promise<TagListItem> {
    const row = await this.prisma.tag.findUnique({ where: { id }, select: TAG_SELECT });
    if (row === null) {
      throw new DomainError(ErrorCode.NOT_FOUND, NOT_FOUND_MESSAGE);
    }
    return toTagListItem(row);
  }

  async create(dto: TagDto): Promise<TagListItem> {
    return toTagListItem(
      await this.translate(() =>
        this.prisma.tag.create({ data: { name: dto.name }, select: TAG_SELECT }),
      ),
    );
  }

  async rename(id: string, dto: TagDto): Promise<TagListItem> {
    return toTagListItem(
      await this.translate(() =>
        this.prisma.tag.update({ where: { id }, data: { name: dto.name }, select: TAG_SELECT }),
      ),
    );
  }

  /** Removing a tag only untags its events; the events themselves stay. */
  async remove(id: string): Promise<void> {
    await this.translate(() => this.prisma.tag.delete({ where: { id }, select: TAG_SELECT }));
  }

  /** Turns the two expected write failures into tag-specific errors. */
  private async translate(write: () => Promise<TagRow>): Promise<TagRow> {
    try {
      return await write();
    } catch (error) {
      const code = prismaErrorCode(error);
      if (code === PrismaErrorCode.UNIQUE_VIOLATION) {
        const message = 'A tag with this name already exists';
        throw new DomainError(ErrorCode.CONFLICT, message, [
          { field: 'name', messages: [message] },
        ]);
      }
      if (code === PrismaErrorCode.NOT_FOUND) {
        throw new DomainError(ErrorCode.NOT_FOUND, NOT_FOUND_MESSAGE);
      }
      throw error;
    }
  }
}
