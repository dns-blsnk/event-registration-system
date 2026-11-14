import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { APP_CONFIG } from './config/config.module.js';

import type { Config } from './config/config.schema.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  app.enableShutdownHooks();
  const config = app.get<Config>(APP_CONFIG);
  await app.listen(config.port);
}

// Written synchronously to stderr: the pino transport is async and would lose the line on exit.
bootstrap().catch((error: unknown) => {
  const details = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`Bootstrap failed: ${details}\n`);
  process.exit(1);
});
