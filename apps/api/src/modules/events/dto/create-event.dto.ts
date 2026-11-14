import { IsUUID } from 'class-validator';

import { OptionalField } from '../../../common/validation/optional.js';

import {
  EventCity,
  EventDate,
  EventDescription,
  EventTagIds,
  EventTitle,
  EventVenue,
} from './event-fields.js';

export class CreateEventDto {
  @EventTitle()
  title!: string;

  @EventDescription()
  description!: string;

  @EventVenue()
  venue!: string;

  @EventCity()
  city!: string;

  @EventDate()
  startsAt!: Date;

  @EventDate()
  endsAt!: Date;

  @OptionalField()
  @EventTagIds()
  tagIds?: string[];

  /** Admins may create an event on behalf of an organizer; organizers always own what they create. */
  @OptionalField()
  @IsUUID('4')
  organizerId?: string;
}
