import { AppLogCategory } from '@ers/shared';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { translatePrismaError } from '../../common/errors/prisma-errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';

import { LogBuffer } from './log-buffer.js';
import { RateWindow } from './rate-window.js';
import { sanitizeEntry } from './sanitize-entry.js';

import type { Prisma } from '../../generated/prisma/client.js';
import type { AppLogEntry } from './app-log-entry.js';

export const BUFFER_CAPACITY = 1000;
export const FLUSH_INTERVAL_MS = 2000;
export const FLUSH_BATCH_SIZE = 200;
/** Per category, so a flood of security events cannot crowd real server errors out. */
export const MAX_ENTRIES_PER_MINUTE = 600;
const MINUTE_MS = 60_000;

function isDatabaseDown(error: unknown): boolean {
  return translatePrismaError(error)?.code === 'SERVICE_UNAVAILABLE';
}

/**
 * Writes the error and security journal without slowing requests down: entries go to an in-memory
 * buffer and are flushed in batches. If the database is down they stay buffered and are written once
 * it is back. Persisting a log entry never throws into the caller.
 */
@Injectable()
export class AppLogService implements OnModuleInit, OnModuleDestroy {
  private readonly buffer = new LogBuffer<AppLogEntry>(BUFFER_CAPACITY);
  private readonly rates: Readonly<Record<AppLogCategory, RateWindow>> = {
    [AppLogCategory.ERROR]: new RateWindow(MAX_ENTRIES_PER_MINUTE, MINUTE_MS),
    [AppLogCategory.SECURITY]: new RateWindow(MAX_ENTRIES_PER_MINUTE, MINUTE_MS),
  };
  private timer: NodeJS.Timeout | undefined;
  private flushing: Promise<boolean> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AppLogService.name);
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.flush(); // flush() never rejects; errors are handled inside
    }, FLUSH_INTERVAL_MS);
    // Do not keep the process alive just for log flushing.
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }

  /** Queues an entry. Synchronous and safe to call from any error path. */
  record(entry: AppLogEntry): void {
    if (!this.rates[entry.category].tryAccept()) {
      return;
    }
    this.buffer.push(sanitizeEntry(entry));
  }

  /**
   * Writes everything buffered at the time of the call. Concurrent calls share the running pass;
   * if entries arrived after that pass started, another pass picks them up. Stops early while the
   * database is down, leaving entries buffered for the next flush.
   */
  async flush(): Promise<void> {
    for (;;) {
      this.flushing ??= this.writeBatches().finally(() => {
        this.flushing = undefined;
      });
      const isDatabaseReachable = await this.flushing;
      if (!isDatabaseReachable || this.buffer.size === 0) {
        return;
      }
    }
  }

  get pendingCount(): number {
    return this.buffer.size;
  }

  /** Returns false when it stopped because the database is down. */
  private async writeBatches(): Promise<boolean> {
    this.reportLosses();
    while (this.buffer.size > 0) {
      const batch = this.buffer.take(FLUSH_BATCH_SIZE);
      try {
        await this.prisma.appLog.createMany({ data: batch.map(toRow) });
      } catch (error) {
        if (isDatabaseDown(error)) {
          this.buffer.restore(batch);
          this.logger.warn(
            { err: error, pending: this.buffer.size },
            'app log flush failed, will retry',
          );
          return false;
        }
        // A data error is permanent: retrying the batch would block the journal forever.
        await this.writeOneByOne(batch);
      }
    }
    return true;
  }

  private async writeOneByOne(batch: readonly AppLogEntry[]): Promise<void> {
    let rejected = 0;
    for (const entry of batch) {
      try {
        await this.prisma.appLog.create({ data: toRow(entry) });
      } catch (error) {
        rejected += 1;
        this.logger.warn({ err: error }, 'app log entry rejected by the database, dropped');
      }
    }
    if (rejected > 0) {
      this.logger.warn({ rejected, batch: batch.length }, 'app log batch had invalid entries');
    }
  }

  private reportLosses(): void {
    const dropped = this.buffer.takeDroppedCount();
    const skipped = this.rates.ERROR.takeRejectedCount() + this.rates.SECURITY.takeRejectedCount();
    if (dropped > 0 || skipped > 0) {
      this.logger.warn({ dropped, skipped }, 'app log entries lost (buffer full or rate limit)');
    }
  }
}

function toRow(entry: AppLogEntry): Prisma.AppLogCreateManyInput {
  const { context, ...fields } = entry;
  return context === undefined ? fields : { ...fields, context };
}
