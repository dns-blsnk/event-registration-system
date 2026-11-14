import { ErrorCode } from '@ers/shared';
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { InjectConfig } from '../../config/config.module.js';
import {
  clearSessionCookieOptions,
  readSessionToken,
  sessionCookieName,
} from '../../modules/auth/session-cookie.js';
import { SessionService } from '../../modules/auth/session.service.js';
import { DomainError } from '../errors/domain-error.js';

import { accessRuleOf } from './access-rule.js';

import type { Config } from '../../config/config.schema.js';
import type { Request, Response } from 'express';

/** Global: resolves the session cookie into request.auth and rejects non-public routes without one. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    @InjectConfig() private readonly config: Config,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const token = readSessionToken(request, this.config);
    // Only a token that was never issued is suspicious; no cookie or an expired session is routine.
    let isSuspicious = false;
    if (token !== undefined) {
      const lookup = await this.sessions.lookup(token);
      if (lookup.status === 'valid') {
        request.auth = lookup.value;
      } else {
        isSuspicious = lookup.status === 'unknown';
        // Drop the dead cookie so the browser stops sending it.
        http
          .getResponse<Response>()
          .clearCookie(sessionCookieName(this.config), clearSessionCookieOptions(this.config));
      }
    }
    const isPublic = accessRuleOf(this.reflector, context)?.kind === 'public';
    if (isPublic || request.auth !== undefined) {
      return true;
    }
    throw new DomainError(ErrorCode.UNAUTHENTICATED, 'Sign in required', undefined, !isSuspicious);
  }
}
