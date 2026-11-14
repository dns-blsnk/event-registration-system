import { can, ErrorCode } from '@ers/shared';
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { DomainError } from '../errors/domain-error.js';

import { accessRuleOf } from './access-rule.js';

import type { Request } from 'express';

/**
 * Global, runs after AuthGuard (which has already rejected anonymous requests to non-public routes).
 * Deny by default: a route without an access rule is closed, not open.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = accessRuleOf(this.reflector, context);
    if (rule?.kind === 'public' || rule?.kind === 'signed-in') {
      return true;
    }
    const { auth } = context.switchToHttp().getRequest<Request>();
    if (
      rule?.kind === 'permission' &&
      auth !== undefined &&
      can(auth.user.role, rule.resource, rule.action)
    ) {
      return true;
    }
    throw new DomainError(ErrorCode.FORBIDDEN, 'You do not have permission to do this');
  }
}
