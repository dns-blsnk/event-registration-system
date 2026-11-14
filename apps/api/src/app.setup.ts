import { API_PREFIX, CSRF_HEADER, REQUEST_ID_HEADER, TOTAL_COUNT_HEADER } from '@ers/shared';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { requestIdMiddleware } from './common/logging/request-id.js';
import { APP_CONFIG } from './config/config.module.js';

import type { Config } from './config/config.schema.js';
import type { NestExpressApplication } from '@nestjs/platform-express';

const CORS_MAX_AGE_SECONDS = 600;

/** HTTP setup shared by the real server and integration tests. Call before app.init(). */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  const config = app.get<Config>(APP_CONFIG);
  // Registered before Nest's body parser so every response, even a parse error, has a request id.
  app.use(requestIdMiddleware);
  // Real client IP behind Render / Vercel, for rate limits, sessions and the journal.
  app.set('trust proxy', config.trustProxyHops);
  app.use(helmet());
  app.use(cookieParser());
  // REST normally arrives through the Vercel rewrite (same origin); CORS covers direct calls and dev.
  app.enableCors({
    origin: config.adminOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['content-type', CSRF_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER, TOTAL_COUNT_HEADER],
    maxAge: CORS_MAX_AGE_SECONDS,
  });
  app.setGlobalPrefix(API_PREFIX);
  return app;
}
