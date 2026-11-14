import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { requestIdOf } from '../logging/request-id.js';

import { toErrorResponse } from './to-error-response.js';

import type { Request, Response } from 'express';

/** The only place that turns HTTP errors into responses. Logs server errors once, with the stack. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@InjectPinoLogger(AllExceptionsFilter.name) private readonly logger: PinoLogger) {}

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
    if (response.headersSent) {
      response.end();
      return;
    }
    response.status(body.statusCode).json(body);
  }
}
