import { NAME_MAX_LENGTH, ROLES, type Role } from '@ers/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';

import { OptionalField } from '../../../common/validation/optional.js';
import { trimString } from '../../../common/validation/transforms.js';

export class UpdateUserDto {
  @OptionalField()
  @Transform(trimString)
  @IsString()
  @Length(1, NAME_MAX_LENGTH)
  name?: string;

  @OptionalField()
  @IsIn(ROLES)
  role?: Role;
}
