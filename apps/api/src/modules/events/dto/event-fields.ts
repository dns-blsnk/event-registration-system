import {
  EVENT_CITY_MAX_LENGTH,
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_MAX_TAGS,
  EVENT_TITLE_MAX_LENGTH,
  EVENT_VENUE_MAX_LENGTH,
} from '@ers/shared';
import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDate, IsString, IsUUID, Length } from 'class-validator';

import { trimString } from '../../../common/validation/transforms.js';

/** One definition of each event field's rules, shared by the create and update DTOs. */
function trimmedText(maxLength: number): PropertyDecorator {
  return applyDecorators(Transform(trimString), IsString(), Length(1, maxLength));
}

export const EventTitle = (): PropertyDecorator => trimmedText(EVENT_TITLE_MAX_LENGTH);
export const EventDescription = (): PropertyDecorator => trimmedText(EVENT_DESCRIPTION_MAX_LENGTH);
export const EventVenue = (): PropertyDecorator => trimmedText(EVENT_VENUE_MAX_LENGTH);
export const EventCity = (): PropertyDecorator => trimmedText(EVENT_CITY_MAX_LENGTH);
export const EventDate = (): PropertyDecorator =>
  applyDecorators(
    Type(() => Date),
    IsDate(),
  );
export const EventTagIds = (): PropertyDecorator =>
  applyDecorators(IsArray(), ArrayMaxSize(EVENT_MAX_TAGS), IsUUID('4', { each: true }));
