import { isAxiosError } from 'axios';

import type { ApiErrorBody } from '@ers/shared';

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

/** The API's error body ({ statusCode, code, message, details?, requestId }) if the error carries one. */
export function apiErrorOf(error: unknown): ApiErrorBody | undefined {
  if (!isAxiosError(error)) {
    return undefined;
  }
  const body: unknown = error.response?.data;
  return isApiErrorBody(body) ? body : undefined;
}

/**
 * HTTP status of a failed request, or undefined when it never got a response (offline, CORS, ...).
 * Understands both raw axios errors and the HttpError shape Refine receives from the data provider.
 */
export function statusOf(error: unknown): number | undefined {
  if (isAxiosError(error)) {
    return error.response?.status;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  ) {
    return error.statusCode;
  }
  return undefined;
}

/**
 * A user-facing message: the API's own text when it sent one (on a raw axios error, or already
 * carried by the data provider's error), otherwise the fallback.
 */
export function messageOf(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    return apiErrorOf(error)?.message ?? fallback;
  }
  return error instanceof Error && 'statusCode' in error ? error.message : fallback;
}
