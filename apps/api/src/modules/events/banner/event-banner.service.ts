import { randomUUID } from 'node:crypto';

import { ErrorCode } from '@ers/shared';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { DomainError } from '../../../common/errors/domain-error.js';
import { assertEventEditable } from '../../../domain/status-transitions.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { StorageService } from '../../storage/index.js';
import { EVENT_NOT_FOUND_MESSAGE, lockScopedEvent } from '../event-lock.js';
import { eventScope } from '../event-scope.js';

import type { User } from '../../../generated/prisma/client.js';

/**
 * Event banners. The image is stored under a fresh key on every upload, so a cached presigned link
 * never shows a half-replaced file; the previous object is removed after the database points at
 * the new one.
 */
@Injectable()
export class EventBannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(EventBannerService.name);
  }

  async replace(eventId: string, image: Uint8Array, actor: User): Promise<void> {
    // Checked before uploading, so nothing is stored for someone else's event or a locked one.
    await this.assertWritable(eventId, actor);
    const key = `events/${eventId}/banner-${randomUUID()}`;
    await this.storage.putImage(key, image);
    let previousKey: string | null;
    try {
      previousKey = await this.prisma.$transaction(async (tx) => {
        const event = await lockScopedEvent(tx, eventId, actor);
        assertEventEditable(event);
        await tx.event.update({ where: { id: eventId }, data: { bannerKey: key } });
        return event.bannerKey;
      });
    } catch (error) {
      await this.discardUnlessSaved(eventId, key);
      throw error;
    }
    await this.deleteQuietly(previousKey);
  }

  /**
   * Allowed on any event, cancelled and completed included: taking an unwanted image down is
   * moderation, not editing history.
   */
  async remove(eventId: string, actor: User): Promise<void> {
    const previousKey = await this.prisma.$transaction(async (tx) => {
      const event = await lockScopedEvent(tx, eventId, actor);
      if (event.bannerKey !== null) {
        await tx.event.update({ where: { id: eventId }, data: { bannerKey: null } });
      }
      return event.bannerKey;
    });
    await this.deleteQuietly(previousKey);
  }

  /** Presigned link for a stored banner, or null. */
  async urlOf(bannerKey: string | null): Promise<string | null> {
    return bannerKey === null ? null : this.storage.presignedGetUrl(bannerKey);
  }

  /**
   * Removing an orphaned object is cleanup, not part of the user's action: if storage is briefly
   * unavailable the banner change still stands, and the leftover object is logged for later.
   */
  async deleteQuietly(key: string | null): Promise<void> {
    if (key === null) {
      return;
    }
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn({ err: error, key }, 'could not delete an orphaned banner object');
    }
  }

  private async assertWritable(eventId: string, actor: User): Promise<void> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, ...eventScope(actor) },
      select: { status: true },
    });
    if (event === null) {
      throw new DomainError(ErrorCode.NOT_FOUND, EVENT_NOT_FOUND_MESSAGE);
    }
    assertEventEditable(event);
  }

  /**
   * After a failed save the new object is normally an orphan. But if the commit reached the
   * database and only the reply was lost, the event already points at it: keep it then.
   */
  private async discardUnlessSaved(eventId: string, key: string): Promise<void> {
    try {
      const saved = await this.prisma.event.findUnique({
        where: { id: eventId },
        select: { bannerKey: true },
      });
      if (saved?.bannerKey === key) {
        return;
      }
    } catch (error) {
      // Unknown state: keeping a possibly orphaned object is safer than breaking a saved banner.
      this.logger.warn({ err: error, key }, 'could not confirm a banner save; keeping the object');
      return;
    }
    await this.deleteQuietly(key);
  }
}
