import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  ROLES,
  type Role,
} from '@ers/shared';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Length, MaxLength } from 'class-validator';

import { trimString } from '../../../common/validation/transforms.js';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  @Transform(trimString)
  @IsString()
  @Length(1, NAME_MAX_LENGTH)
  name!: string;

  @IsIn(ROLES)
  role!: Role;

  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  password!: string;
}
