import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module.js';

import { EventBannerController } from './banner/event-banner.controller.js';
import { EventBannerService } from './banner/event-banner.service.js';
import { EventLifecycleService } from './event-lifecycle.service.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [StorageModule],
  controllers: [EventsController, EventBannerController],
  providers: [EventsService, EventLifecycleService, EventBannerService],
  exports: [EventBannerService, EventsService],
})
export class EventsModule {}
