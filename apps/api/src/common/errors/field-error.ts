import { ErrorCode } from '@ers/shared';

import { DomainError } from './domain-error.js';

/** VALIDATION_FAILED for one field, in the same shape the validation pipe produces. */
export function fieldError(field: string, message: string, summary = message): DomainError {
  return new DomainError(ErrorCode.VALIDATION_FAILED, summary, [{ field, messages: [message] }]);
}
