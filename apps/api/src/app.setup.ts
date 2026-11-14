import { requestIdMiddleware } from './common/logging/request-id.js';

import type { INestApplication } from '@nestjs/common';

export const API_PREFIX = 'api';

/** HTTP setup shared by the real server and integration tests. Call before app.init(). */
export function configureApp(app: INestApplication): INestApplication {
  // Registered before Nest's body parser so every response, even a parse error, has a request id.
  app.use(requestIdMiddleware);
  app.setGlobalPrefix(API_PREFIX);
  return app;
}
