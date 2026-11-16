import {
  SESSION_MAX_CAPACITY,
  SESSION_ROOM_MAX_LENGTH,
  SESSION_SPEAKER_MAX_LENGTH,
  SESSION_TITLE_MAX_LENGTH,
} from '@ers/shared';
import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsInt, IsString, Length, Max, Min } from 'class-validator';

import { trimString } from '../../../common/validation/transforms.js';

/** One definition of each session field's rules, shared by the create and update DTOs. */
function trimmedText(maxLength: number): PropertyDecorator {
  return applyDecorators(Transform(trimString), IsString(), Length(1, maxLength));
}

export const SessionTitle = (): PropertyDecorator => trimmedText(SESSION_TITLE_MAX_LENGTH);
export const SessionSpeaker = (): PropertyDecorator => trimmedText(SESSION_SPEAKER_MAX_LENGTH);
export const SessionRoom = (): PropertyDecorator => trimmedText(SESSION_ROOM_MAX_LENGTH);
export const SessionDate = (): PropertyDecorator =>
  applyDecorators(
    Type(() => Date),
    IsDate(),
  );
export const SessionCapacity = (): PropertyDecorator =>
  applyDecorators(IsInt(), Min(1), Max(SESSION_MAX_CAPACITY));
