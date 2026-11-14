import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module.js';

import { EventBannerController } from './event-banner.controller.js';
import { EventBannerService } from './event-banner.service.js';
import { EventLifecycleService } from './event-lifecycle.service.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [StorageModule],
  controllers: [EventsController, EventBannerController],
  providers: [EventsService, EventLifecycleService, EventBannerService],
  exports: [EventsService, EventBannerService],
})
export class EventsModule {}
