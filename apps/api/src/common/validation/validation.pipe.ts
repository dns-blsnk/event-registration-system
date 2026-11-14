import { ErrorCode, type FieldError } from '@ers/shared';
import { ValidationPipe, type ValidationError } from '@nestjs/common';

import { DomainError } from '../errors/domain-error.js';

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent === '' ? error.property : `${parent}.${error.property}`;
    const own =
      error.constraints === undefined
        ? []
        : [{ field, messages: Object.values(error.constraints) }];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/** Strict DTO validation: unknown fields are rejected, failures become VALIDATION_FAILED. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) =>
      new DomainError(ErrorCode.VALIDATION_FAILED, 'Validation failed', flatten(errors)),
  });
}
