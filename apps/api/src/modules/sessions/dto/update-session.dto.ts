import { NullableField, OptionalField } from '../../../common/validation/optional.js';

import {
  SessionCapacity,
  SessionDate,
  SessionRoom,
  SessionSpeaker,
  SessionTitle,
} from './session-fields.js';

/** The event of a session never changes; move a session by deleting and recreating it. */
export class UpdateSessionDto {
  @OptionalField()
  @SessionTitle()
  title?: string;

  /** null clears the speaker. */
  @NullableField()
  @SessionSpeaker()
  speaker?: string | null;

  /** null clears the room. */
  @NullableField()
  @SessionRoom()
  room?: string | null;

  @OptionalField()
  @SessionDate()
  startsAt?: Date;

  @OptionalField()
  @SessionDate()
  endsAt?: Date;

  @OptionalField()
  @SessionCapacity()
  capacity?: number;
}
