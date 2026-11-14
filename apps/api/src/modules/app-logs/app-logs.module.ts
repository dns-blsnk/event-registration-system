import { Global, Module } from '@nestjs/common';

import { AppLogRetentionService } from './app-log-retention.service.js';
import { AppLogService } from './app-log.service.js';

@Global()
@Module({
  providers: [AppLogService, AppLogRetentionService],
  exports: [AppLogService],
})
export class AppLogsModule {}
