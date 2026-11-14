import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { LoggingModule } from './common/logging/logging.module.js';
import { createValidationPipe } from './common/validation/validation.pipe.js';
import { ConfigModule } from './config/config.module.js';
import { AppLogsModule } from './modules/app-logs/app-logs.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    AppLogsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
})
export class AppModule {}
