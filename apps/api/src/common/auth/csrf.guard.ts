import { CSRF_HEADER, ErrorCode } from '@ers/shared';
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { InjectConfig } from '../../config/config.module.js';
import { tokensMatch } from '../../modules/auth/session-tokens.js';
import { DomainError } from '../errors/domain-error.js';

import { SKIP_CSRF_TOKEN_KEY } from './skip-csrf-token.decorator.js';

import type { Config } from '../../config/config.schema.js';
import type { Request } from 'express';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global, runs after AuthGuard. For state-changing requests:
 * - a browser Origin header, when present, must be the admin's origin (also blocks login CSRF);
 * - a signed-in request must echo its session's CSRF token in the X-CSRF-Token header.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectConfig() private readonly config: Config,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) {
      return true;
    }
    const origin = request.get('origin');
    if (origin !== undefined && origin !== this.config.adminOrigin) {
      throw new DomainError(ErrorCode.CSRF_INVALID, 'Request origin is not allowed');
    }
    const skipToken = this.reflector.getAllAndOverride<boolean | undefined>(SKIP_CSRF_TOKEN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipToken === true || request.auth === undefined) {
      return true;
    }
    if (!tokensMatch(request.auth.session.csrfToken, request.get(CSRF_HEADER))) {
      throw new DomainError(ErrorCode.CSRF_INVALID, 'Missing or invalid CSRF token');
    }
    return true;
  }
}
