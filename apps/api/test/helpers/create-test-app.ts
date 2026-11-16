import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { APP_CONFIG, loadConfig } from '../../src/config/config.module.js';

import type { Config } from '../../src/config/config.schema.js';
import type { INestApplication, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

interface ProviderOverride {
  provide: Type | symbol;
  useValue: unknown;
}

interface TestAppOptions {
  /** Extra test-only controllers, e.g. fixtures that raise specific errors. */
  controllers?: Type[];
  /** Replace real providers, e.g. a Prisma client pointed at an unreachable database. */
  overrides?: ProviderOverride[];
  /**
   * Redis key namespace. Each app gets its own by default, so rate limits and counters start empty
   * as they did in memory; pass the same one to two apps to test state they share.
   */
  redisKeyPrefix?: string;
}

/** The test's own config override if it has one, with this app's Redis key namespace. */
function configFor(options: TestAppOptions): Config {
  const override = options.overrides?.find(({ provide }) => provide === APP_CONFIG);
  const config = (override?.useValue as Config | undefined) ?? loadConfig();
  const keyPrefix = options.redisKeyPrefix ?? `test:${randomUUID()}:`;
  return { ...config, redis: { ...config.redis, keyPrefix } };
}

export async function createTestApp(options: TestAppOptions = {}): Promise<INestApplication> {
  const builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  });
  for (const override of options.overrides ?? []) {
    // The config is applied below, once, with this app's Redis key namespace added.
    if (override.provide !== APP_CONFIG) {
      builder.overrideProvider(override.provide).useValue(override.useValue);
    }
  }
  builder.overrideProvider(APP_CONFIG).useValue(configFor(options));
  const app = configureApp(
    (await builder.compile()).createNestApplication<NestExpressApplication>(),
  );
  await app.init();
  return app;
}
