import { OptionalField } from '../../../common/validation/optional.js';

import {
  EventCity,
  EventDate,
  EventDescription,
  EventTagIds,
  EventTitle,
  EventVenue,
} from './event-fields.js';

/** Every field optional, but null is rejected. Status changes go through publish/cancel/complete. */
export class UpdateEventDto {
  @OptionalField()
  @EventTitle()
  title?: string;

  @OptionalField()
  @EventDescription()
  description?: string;

  @OptionalField()
  @EventVenue()
  venue?: string;

  @OptionalField()
  @EventCity()
  city?: string;

  @OptionalField()
  @EventDate()
  startsAt?: Date;

  @OptionalField()
  @EventDate()
  endsAt?: Date;

  @OptionalField()
  @EventTagIds()
  tagIds?: string[];
}
