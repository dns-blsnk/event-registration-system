import type { INestApplication } from '@nestjs/common';

export const API_PREFIX = 'api';

/** HTTP setup shared by the real server and integration tests. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(API_PREFIX);
  return app;
}
