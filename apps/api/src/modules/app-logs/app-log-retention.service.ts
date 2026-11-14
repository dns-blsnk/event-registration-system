import { APP_LOG_RETENTION_DAYS } from '@ers/shared';
import { Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '../../prisma/prisma.service.js';

const DAY_MS = 86_400_000;
export const DELETE_BATCH_SIZE = 5000;

export function retentionCutoff(now: Date): Date {
  return new Date(now.getTime() - APP_LOG_RETENTION_DAYS * DAY_MS);
}

/** Deletes journal entries older than the retention period, in batches to keep locks short. */
@Injectable()
export class AppLogRetentionService implements OnApplicationBootstrap, OnModuleDestroy {
  private startupPurge: Promise<number> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AppLogRetentionService.name);
  }

  /** Also runs at startup: free hosting sleeps when idle, so the nightly cron can be missed. */
  onApplicationBootstrap(): void {
    // Not awaited so startup is not delayed; purgeExpired() never rejects.
    this.startupPurge = this.purgeExpired();
  }

  /** Resolves when the startup purge has finished (tests and shutdown wait for it). */
  async whenStartupPurgeDone(): Promise<void> {
    await this.startupPurge;
  }

  async onModuleDestroy(): Promise<void> {
    await this.whenStartupPurgeDone();
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const cutoff = retentionCutoff(now);
    let total = 0;
    try {
      for (;;) {
        const deleted = await this.prisma.$executeRaw`
          DELETE FROM app_logs
          WHERE id IN (SELECT id FROM app_logs WHERE created_at < ${cutoff} LIMIT ${DELETE_BATCH_SIZE})`;
        total += deleted;
        if (deleted < DELETE_BATCH_SIZE) {
          break;
        }
      }
      this.logger.info({ deleted: total, cutoff }, 'expired app logs purged');
    } catch (error) {
      this.logger.warn({ err: error, deleted: total }, 'app log purge failed, will retry next run');
    }
    return total;
  }
}
