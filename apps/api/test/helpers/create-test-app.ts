import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

import type { INestApplication, Type } from '@nestjs/common';

interface ProviderOverride {
  provide: Type | symbol;
  useValue: unknown;
}

interface TestAppOptions {
  /** Extra test-only controllers, e.g. fixtures that raise specific errors. */
  controllers?: Type[];
  /** Replace real providers, e.g. a Prisma client pointed at an unreachable database. */
  overrides?: ProviderOverride[];
}

export async function createTestApp(options: TestAppOptions = {}): Promise<INestApplication> {
  const builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  });
  for (const override of options.overrides ?? []) {
    builder.overrideProvider(override.provide).useValue(override.useValue);
  }
  const app = configureApp((await builder.compile()).createNestApplication());
  await app.init();
  return app;
}
