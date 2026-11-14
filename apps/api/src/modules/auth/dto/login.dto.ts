import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from '@ers/shared';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  // No minimum here: login must not reveal the password policy; only cap the hashing cost.
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  password!: string;
}
