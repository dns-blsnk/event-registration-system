/** Machine-readable error codes returned by the API in every error body. */
export const ErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  CSRF_INVALID: 'CSRF_INVALID',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  EVENT_NOT_OPEN: 'EVENT_NOT_OPEN',
  SESSION_STARTED: 'SESSION_STARTED',
  SCHEDULE_CONFLICT: 'SCHEDULE_CONFLICT',
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface FieldError {
  field: string;
  messages: string[];
}

/** Shape of every error response from the API. */
export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: FieldError[];
  requestId: string;
}

/** Header that carries the request id on every API response. */
export const REQUEST_ID_HEADER = 'x-request-id';
