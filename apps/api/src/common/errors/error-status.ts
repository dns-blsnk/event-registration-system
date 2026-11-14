import { ErrorCode } from '@ers/shared';
import { HttpStatus } from '@nestjs/common';

/** Statuses from this value up are our failures, not the client's. */
export const SERVER_ERROR_MIN_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

/** HTTP status for each error code. Exhaustive: a new code fails typecheck until mapped. */
export const ERROR_STATUS: Readonly<Record<ErrorCode, number>> = {
  [ErrorCode.BAD_REQUEST]: HttpStatus.BAD_REQUEST,
  [ErrorCode.VALIDATION_FAILED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.UNAUTHENTICATED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ErrorCode.CSRF_INVALID]: HttpStatus.FORBIDDEN,
  [ErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.CONFLICT]: HttpStatus.CONFLICT,
  [ErrorCode.INVALID_TRANSITION]: HttpStatus.CONFLICT,
  [ErrorCode.EVENT_NOT_OPEN]: HttpStatus.CONFLICT,
  [ErrorCode.SESSION_STARTED]: HttpStatus.CONFLICT,
  [ErrorCode.SCHEDULE_CONFLICT]: HttpStatus.CONFLICT,
  [ErrorCode.ALREADY_REGISTERED]: HttpStatus.CONFLICT,
  [ErrorCode.PAYLOAD_TOO_LARGE]: HttpStatus.PAYLOAD_TOO_LARGE,
  [ErrorCode.RATE_LIMITED]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
};

const CODE_BY_HTTP_STATUS: ReadonlyMap<number, ErrorCode> = new Map<number, ErrorCode>([
  [HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST],
  [HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED],
  [HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN],
  [HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND],
  [HttpStatus.CONFLICT, ErrorCode.CONFLICT],
  [HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.PAYLOAD_TOO_LARGE],
  [HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED],
  [HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.SERVICE_UNAVAILABLE],
]);

/** Code for errors raised by Nest or Express (unknown route, wrong method, bad body, ...). */
export function codeForHttpStatus(status: number): ErrorCode {
  const known = CODE_BY_HTTP_STATUS.get(status);
  if (known !== undefined) {
    return known;
  }
  return status >= SERVER_ERROR_MIN_STATUS ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST;
}
