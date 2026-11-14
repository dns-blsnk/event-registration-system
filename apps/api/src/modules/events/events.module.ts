import { Module } from '@nestjs/common';

import { EventLifecycleService } from './event-lifecycle.service.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  controllers: [EventsController],
  providers: [EventsService, EventLifecycleService],
  exports: [EventsService],
})
export class EventsModule {}
