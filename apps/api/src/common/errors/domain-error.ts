import type { ErrorCode, FieldError } from '@ers/shared';

/** Expected failure with a stable code. The exception filter maps it to an HTTP response. */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: FieldError[],
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
