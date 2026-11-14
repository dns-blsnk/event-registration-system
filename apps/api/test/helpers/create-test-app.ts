import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

import type { INestApplication, Type } from '@nestjs/common';

interface TestAppOptions {
  /** Extra test-only controllers, e.g. fixtures that raise specific errors. */
  controllers?: Type[];
}

export async function createTestApp(options: TestAppOptions = {}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  }).compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}
