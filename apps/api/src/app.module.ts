import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthGuard } from './common/auth/auth.guard.js';
import { CsrfGuard } from './common/auth/csrf.guard.js';
import { HttpThrottlerGuard } from './common/auth/http-throttler.guard.js';
import { PermissionGuard } from './common/auth/permission.guard.js';
import { RedisThrottlerStorage } from './common/auth/redis-throttler-storage.js';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { LoggingModule } from './common/logging/logging.module.js';
import { MINUTE_MS } from './common/time.js';
import { createValidationPipe } from './common/validation/validation.pipe.js';
import { ConfigModule } from './config/config.module.js';
import { AppLogsModule } from './modules/app-logs/app-logs.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PinnedEventsModule } from './modules/pinned-events/pinned-events.module.js';
import { RegistrationsModule } from './modules/registrations/registrations.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { TagsModule } from './modules/tags/tags.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { RedisService } from './redis/redis.service.js';

/** Generous default per IP; sensitive routes (login, signup, chat) set stricter limits. */
const REQUESTS_PER_MINUTE_PER_IP = 300;

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ name: 'default', ttl: MINUTE_MS, limit: REQUESTS_PER_MINUTE_PER_IP }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    PrismaModule,
    RedisModule,
    AppLogsModule,
    AuthModule,
    UsersModule,
    EventsModule,
    PinnedEventsModule,
    SessionsModule,
    RegistrationsModule,
    TagsModule,
    CustomersModule,
    CatalogModule,
    ChatModule,
    StorageModule,
    HealthModule,
  ],
  providers: [
    // Order matters: rate limit, resolve the session, check CSRF, then check the role's permission.
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
})
export class AppModule {}
