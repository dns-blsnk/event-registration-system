import { Module } from '@nestjs/common';

import { BookingService } from './booking.service.js';
import { MyRegistrationsController } from './my-registrations.controller.js';
import { MyRegistrationsService } from './my-registrations.service.js';
import { RegistrationStatusService } from './registration-status.service.js';
import { RegistrationsController } from './registrations.controller.js';
import { RegistrationsService } from './registrations.service.js';

@Module({
  controllers: [MyRegistrationsController, RegistrationsController],
  providers: [
    BookingService,
    MyRegistrationsService,
    RegistrationsService,
    RegistrationStatusService,
  ],
})
export class RegistrationsModule {}
