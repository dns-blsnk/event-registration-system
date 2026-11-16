import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { AppLogService } from '../../modules/app-logs/index.js';
import { requestIdOf } from '../logging/request-id.js';

import { errorLogEntry } from './error-log-entry.js';
import { toErrorResponse } from './to-error-response.js';

import type { Request, Response } from 'express';

/**
 * The only place that turns HTTP errors into responses. Server errors are logged once with the
 * stack (stdout) and, like security-relevant failures, recorded in the admin-visible journal.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    private readonly appLogs: AppLogService,
  ) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      // WebSocket and other contexts have their own filters.
      throw exception;
    }
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const { body, isServerError } = toErrorResponse(exception, requestIdOf(request));

    if (isServerError) {
      this.logger.error(
        { err: exception, code: body.code, requestId: body.requestId },
        'request failed',
      );
    }
    const entry = errorLogEntry(exception, body, request, isServerError);
    if (entry !== undefined) {
      this.appLogs.record(entry);
    }
    if (response.headersSent) {
      response.end();
      return;
    }
    response.status(body.statusCode).json(body);
  }
}
