import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { Global, Inject, Module } from '@nestjs/common';

import { parseConfig } from './config.schema.js';

export const APP_CONFIG = Symbol('APP_CONFIG');

/** Injects the validated, typed application config. */
export const InjectConfig = (): ParameterDecorator => Inject(APP_CONFIG);

const LOCAL_ENV_FILES = ['.env', '../../.env'];

// Only the `dev` script sets NODE_ENV=development before start, so a .env file can never switch
// a production or test process into loading local settings (loadEnvFile never overrides set vars).
function loadLocalEnvFile(): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  const file = LOCAL_ENV_FILES.map((path) => resolve(process.cwd(), path)).find((path) =>
    existsSync(path),
  );
  if (file !== undefined) {
    process.loadEnvFile(file);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => {
        loadLocalEnvFile();
        return parseConfig(process.env);
      },
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
