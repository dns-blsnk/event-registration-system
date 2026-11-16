import type { ErrorCode, FieldError } from '@ers/shared';

/** Expected failure with a stable code. The exception filter maps it to an HTTP response. */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: FieldError[],
    /** True for routine outcomes (e.g. "not signed in yet") that must not flood the security journal. */
    readonly isRoutine = false,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
