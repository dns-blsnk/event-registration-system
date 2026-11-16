import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PinoLogger } from 'nestjs-pino';

import { InjectConfig } from '../config/config.module.js';

import type { Config } from '../config/config.schema.js';

/** Fail fast instead of hanging when Redis stops answering, like the database pool does. */
const REDIS_CONNECT_TIMEOUT_MS = 3000;
const REDIS_COMMAND_TIMEOUT_MS = 2000;
/** A request waits for one reconnect at most; after that it fails and the caller answers 503. */
const REDIS_MAX_RETRIES_PER_REQUEST = 1;

type ConnectionState = 'unknown' | 'up' | 'down';

/**
 * Single Redis client per process. Holds short-lived shared state, so several API instances agree
 * on it: chat tickets and history, login failure counters, rate limits. Every key has a TTL.
 */
@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  /** Logged on change only: ioredis reports every failed reconnect attempt again. */
  private state: ConnectionState = 'unknown';
  private isClosing = false;

  constructor(
    @InjectConfig() config: Config,
    private readonly logger: PinoLogger,
  ) {
    super(config.redis.url, {
      keyPrefix: config.redis.keyPrefix,
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
      maxRetriesPerRequest: REDIS_MAX_RETRIES_PER_REQUEST,
    });
    logger.setContext(RedisService.name);
    this.on('ready', () => {
      if (this.state !== 'up') logger.info('redis connected');
      this.state = 'up';
    });
    // An unreachable Redis raises 'error'; a restart that closes the socket cleanly only 'close'.
    this.on('error', (error: Error) => {
      this.markDown(error);
    });
    this.on('close', () => {
      this.markDown();
    });
  }

  onModuleDestroy(): void {
    this.isClosing = true;
    // Not quit(): it waits for a reply that never comes when Redis is already gone.
    this.disconnect();
  }

  private markDown(error?: Error): void {
    if (this.isClosing || this.state === 'down') return;
    this.state = 'down';
    // Name and message only: reply errors carry the failed command's arguments, which for a
    // rejected AUTH during a reconnect include the password.
    const err = error === undefined ? undefined : { name: error.name, message: error.message };
    this.logger.warn({ err }, 'redis unavailable');
  }
}
