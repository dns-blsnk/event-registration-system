import { ErrorCode } from '@ers/shared';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsEmail } from 'class-validator';

import { Public } from '../../src/common/auth/public.decorator.js';
import { DomainError } from '../../src/common/errors/domain-error.js';

class EmailDto {
  @IsEmail()
  email!: string;
}

/** Test-only routes that raise each kind of error. */
@Public()
@Controller('test-errors')
export class ErrorsFixtureController {
  @Get('conflict')
  conflict(): never {
    throw new DomainError(ErrorCode.CONFLICT, 'Email is already taken');
  }

  @Get('crash')
  crash(): never {
    throw new Error('database password is hunter2');
  }

  @Post('validate')
  validate(@Body() body: EmailDto): EmailDto {
    return body;
  }
}
