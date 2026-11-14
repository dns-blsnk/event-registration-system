import { ErrorCode, type ApiErrorBody } from '@ers/shared';
import { HttpException } from '@nestjs/common';

import { DomainError } from './domain-error.js';
import { codeForHttpStatus, ERROR_STATUS, SERVER_ERROR_MIN_STATUS } from './error-status.js';

const CLIENT_ERROR_MIN_STATUS = 400;
const INTERNAL_MESSAGE = 'Something went wrong. Please try again later.';

/** Fixed texts for errors raised before our code runs; their own messages can quote the request body. */
const TRANSPORT_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'entity.parse.failed': 'Request body is not valid JSON',
  'entity.too.large': 'Request body is too large',
  'encoding.unsupported': 'Request body encoding is not supported',
  'charset.unsupported': 'Request body charset is not supported',
};
const TRANSPORT_FALLBACK_MESSAGE = 'Request could not be processed';

export interface ErrorResponse {
  body: ApiErrorBody;
  /** True when the failure is ours (5xx) and must be logged with its stack. */
  isServerError: boolean;
}

/** Errors created by Express middleware via http-errors (body parser and friends). */
interface TransportError {
  status: number;
  type?: string;
}

function isTransportError(value: unknown): value is TransportError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof value.status === 'number' &&
    value.status >= CLIENT_ERROR_MIN_STATUS &&
    value.status < SERVER_ERROR_MIN_STATUS
  );
}

function messageOf(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'object' && 'message' in response) {
    const { message } = response;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
      return message.join('; ');
    }
  }
  return exception.message;
}

function build(
  statusCode: number,
  code: ErrorCode,
  message: string,
  requestId: string,
): ErrorResponse {
  const isServerError = statusCode >= SERVER_ERROR_MIN_STATUS;
  return {
    isServerError,
    body: { statusCode, code, message: isServerError ? INTERNAL_MESSAGE : message, requestId },
  };
}

/** Turns any thrown value into the public error body. Never exposes internals of 5xx errors. */
export function toErrorResponse(exception: unknown, requestId: string): ErrorResponse {
  if (exception instanceof DomainError) {
    const response = build(
      ERROR_STATUS[exception.code],
      exception.code,
      exception.message,
      requestId,
    );
    if (exception.details !== undefined) {
      response.body.details = exception.details;
    }
    return response;
  }
  // Nest wraps body-parser failures in BadRequestException with the raw error as cause.
  const transportError = exception instanceof HttpException ? exception.cause : exception;
  if (isTransportError(transportError)) {
    const message =
      TRANSPORT_ERROR_MESSAGES[transportError.type ?? ''] ?? TRANSPORT_FALLBACK_MESSAGE;
    return build(
      transportError.status,
      codeForHttpStatus(transportError.status),
      message,
      requestId,
    );
  }
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    return build(statusCode, codeForHttpStatus(statusCode), messageOf(exception), requestId);
  }
  return build(SERVER_ERROR_MIN_STATUS, ErrorCode.INTERNAL_ERROR, INTERNAL_MESSAGE, requestId);
}
