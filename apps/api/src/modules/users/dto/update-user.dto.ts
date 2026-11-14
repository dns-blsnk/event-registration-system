import { NAME_MAX_LENGTH, ROLES, type Role } from '@ers/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

import { trimString } from '../../../common/validation/transforms.js';

export class UpdateUserDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: Role;
}
