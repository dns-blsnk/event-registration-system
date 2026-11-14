import { ValidateIf } from 'class-validator';

/**
 * Optional field that, when present, must pass its validators. Unlike @IsOptional(), an explicit
 * null is validated (and rejected) instead of being let through to the database.
 */
export function OptionalField(): PropertyDecorator {
  return ValidateIf((_object: unknown, value: unknown) => value !== undefined);
}
