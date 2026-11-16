import { AppLogCategory, AppLogLevel, CHAT_NAMESPACE, type ErrorCode } from '@ers/shared';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { DomainError } from '../../common/errors/domain-error.js';
import { toErrorResponse } from '../../common/errors/to-error-response.js';
import { AppLogService } from '../app-logs/index.js';

/** Socket messages have no HTTP request id; the public body's id is not used here. */
const NO_REQUEST_ID = '';

/** What the user is told about a failed question. */
export interface ChatFailure {
  code: ErrorCode;
  message: string;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'a value that is not an Error was thrown';
}

/**
 * Logs a chat failure once, classified by the same rules as HTTP errors: a server error (5xx,
 * including a database outage or a crash) goes to stdout and the Logs page with its cause; any
 * other outcome (e.g. the provider is busy, 429) is a warning in stdout only. The question text
 * never reaches either log.
 */
@Injectable()
export class ChatFailures {
  constructor(
    private readonly journal: AppLogService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ChatFailures.name);
  }

  /**
   * A question that failed: logged as its kind deserves, with what to tell the user. `what` names
   * the step that failed, so the log tells a failed answer from a failed check before it.
   */
  record(userId: string, error: unknown, what = 'chat answer failed'): ChatFailure {
    const { body, isServerError } = toErrorResponse(error, NO_REQUEST_ID);
    // Chat errors carry their own safe texts ("took too long"); anything else gets the public one.
    const message = error instanceof DomainError ? error.message : body.message;
    const cause = error instanceof DomainError ? (error.cause ?? error) : error;
    if (isServerError) {
      this.journalError({ what, cause, errorCode: body.code, userId });
    } else {
      this.logger.warn({ err: cause, userId, code: body.code }, what);
    }
    return { code: body.code, message };
  }

  /** A handshake that crashed (e.g. the database is down); refusals are journalled by the handshake. */
  recordHandshakeCrash(error: unknown): void {
    const { body } = toErrorResponse(error, NO_REQUEST_ID);
    this.journalError({ what: 'chat handshake failed', cause: error, errorCode: body.code });
  }

  private journalError(input: {
    what: string;
    cause: unknown;
    errorCode: ErrorCode;
    userId?: string;
  }): void {
    const { what, cause, errorCode, userId } = input;
    this.logger.error({ err: cause, userId, code: errorCode }, what);
    this.journal.record({
      level: AppLogLevel.ERROR,
      category: AppLogCategory.ERROR,
      message: `${what}: ${messageOf(cause)}`,
      route: CHAT_NAMESPACE,
      errorCode,
      ...(userId === undefined ? {} : { userId }),
      ...(cause instanceof Error && cause.stack !== undefined ? { stack: cause.stack } : {}),
    });
  }
}
