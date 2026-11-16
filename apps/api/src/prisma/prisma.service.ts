import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { InjectConfig } from '../config/config.module.js';
import { PrismaClient } from '../generated/prisma/client.js';

import type { Config } from '../config/config.schema.js';

/** Fail fast instead of hanging when the database stops answering (failover, network drop). */
export const DB_CONNECT_TIMEOUT_MS = 3000;
const DB_STATEMENT_TIMEOUT_MS = 10_000;
const DB_IDLE_TIMEOUT_MS = 30_000;
/**
 * Bookings for one popular session queue on its row lock inside their transactions. Prisma's
 * defaults (2 s to get a connection, 5 s per transaction) turn a short queue under load into
 * spurious "try again" conflicts; these leave room for it while still failing fast on a real hang.
 */
export const TRANSACTION_MAX_WAIT_MS = 5000;
export const TRANSACTION_TIMEOUT_MS = 15_000;

/** Single Prisma client per process (one connection pool). Only services use it. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@InjectConfig() config: Config) {
    super({
      adapter: new PrismaPg({
        connectionString: config.databaseUrl,
        connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
        idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
        statement_timeout: DB_STATEMENT_TIMEOUT_MS,
      }),
      transactionOptions: { maxWait: TRANSACTION_MAX_WAIT_MS, timeout: TRANSACTION_TIMEOUT_MS },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
