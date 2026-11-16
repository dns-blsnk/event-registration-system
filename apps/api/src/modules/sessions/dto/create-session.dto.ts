import { IsUUID } from 'class-validator';

import { OptionalField } from '../../../common/validation/optional.js';

import {
  SessionCapacity,
  SessionDate,
  SessionRoom,
  SessionSpeaker,
  SessionTitle,
} from './session-fields.js';

export class CreateSessionDto {
  @IsUUID('4')
  eventId!: string;

  @SessionTitle()
  title!: string;

  @OptionalField()
  @SessionSpeaker()
  speaker?: string;

  @OptionalField()
  @SessionRoom()
  room?: string;

  @SessionDate()
  startsAt!: Date;

  @SessionDate()
  endsAt!: Date;

  @SessionCapacity()
  capacity!: number;
}
