import { AppLogCategory, AppLogLevel, type ApiErrorBody } from '@ers/shared';
import { HttpStatus } from '@nestjs/common';

import { pathOf } from '../logging/pino-options.js';

import type { AppLogEntry } from '../../modules/app-logs/app-log-entry.js';
import type { Request } from 'express';

/** Responses that signal a possible attack or abuse and belong in the security journal. */
const SECURITY_STATUSES: ReadonlySet<number> = new Set([
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.TOO_MANY_REQUESTS,
]);

function routeOf(request: Request): string {
  const template: unknown = (request.route as { path?: unknown } | undefined)?.path;
  return typeof template === 'string' ? template : pathOf(request);
}

function requestContext(
  request: Request,
): Pick<AppLogEntry, 'method' | 'route' | 'ip' | 'userAgent'> {
  const userAgent = request.get('user-agent');
  return {
    method: request.method,
    route: routeOf(request),
    ...(request.ip === undefined ? {} : { ip: request.ip }),
    ...(userAgent === undefined ? {} : { userAgent }),
  };
}

function stackOf(exception: unknown): string | undefined {
  return exception instanceof Error ? exception.stack : undefined;
}

/**
 * Journal entry for an error response, or undefined when it is an ordinary client error
 * (validation, not found, business rule) that only belongs in the access log.
 */
export function errorLogEntry(
  exception: unknown,
  body: ApiErrorBody,
  request: Request,
  isServerError: boolean,
): AppLogEntry | undefined {
  const isSecurity = SECURITY_STATUSES.has(body.statusCode);
  if (!isServerError && !isSecurity) {
    return undefined;
  }
  const internalMessage = exception instanceof Error ? exception.message : body.message;
  const stack = isServerError ? stackOf(exception) : undefined;
  return {
    ...requestContext(request),
    level: isServerError ? AppLogLevel.ERROR : AppLogLevel.WARN,
    category: isServerError ? AppLogCategory.ERROR : AppLogCategory.SECURITY,
    // Server errors keep the real cause for the admin; the client only ever sees the generic text.
    message: isServerError ? internalMessage : body.message,
    requestId: body.requestId,
    statusCode: body.statusCode,
    errorCode: body.code,
    ...(stack === undefined ? {} : { stack }),
  };
}
