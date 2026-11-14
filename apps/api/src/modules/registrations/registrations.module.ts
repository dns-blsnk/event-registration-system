import { Module } from '@nestjs/common';

import { BookingService } from './booking.service.js';
import { MyRegistrationsController } from './my-registrations.controller.js';
import { MyRegistrationsService } from './my-registrations.service.js';

@Module({
  controllers: [MyRegistrationsController],
  providers: [BookingService, MyRegistrationsService],
  exports: [BookingService],
})
export class RegistrationsModule {}
