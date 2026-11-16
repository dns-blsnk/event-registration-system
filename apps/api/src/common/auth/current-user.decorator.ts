import { ErrorCode } from '@ers/shared';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { DomainError } from '../errors/domain-error.js';

import type { AuthContext } from './auth-context.js';
import type { Request } from 'express';

/** The signed-in user's session context. Only valid on routes that require a session. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const { auth } = context.switchToHttp().getRequest<Request>();
    if (auth === undefined) {
      throw new DomainError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
    }
    return auth;
  },
);
