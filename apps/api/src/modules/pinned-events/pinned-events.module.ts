import { Module } from '@nestjs/common';

import { PinnedEventsController } from './pinned-events.controller.js';
import { PinnedEventsService } from './pinned-events.service.js';

@Module({
  controllers: [PinnedEventsController],
  providers: [PinnedEventsService],
})
export class PinnedEventsModule {}
