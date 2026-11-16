import { Global, Module } from '@nestjs/common';

import { AppLogRetentionService } from './app-log-retention.service.js';
import { AppLogService } from './app-log.service.js';
import { AppLogsReadService } from './app-logs-read.service.js';
import { AppLogsController } from './app-logs.controller.js';

@Global()
@Module({
  controllers: [AppLogsController],
  providers: [AppLogService, AppLogRetentionService, AppLogsReadService],
  exports: [AppLogService],
})
export class AppLogsModule {}
