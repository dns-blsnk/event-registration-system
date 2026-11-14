import { Action, Resource, type Role } from '@ers/shared';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { domainErrorCode } from '../../../test/helpers/domain-error.js';

import { Public, RequirePermission, SignedIn } from './access.decorator.js';
import { PermissionGuard } from './permission.guard.js';

import type { ExecutionContext } from '@nestjs/common';

const guard = new PermissionGuard(new Reflector());

class OpenRoutes {
  @Public()
  open(): void {
    // public
  }

  @SignedIn()
  anyone(): void {
    // any signed-in user
  }

  @RequirePermission(Resource.USERS, Action.LIST)
  usersOnly(): void {
    // admin only
  }

  undeclared(): void {
    // no rule
  }
}

@SignedIn()
class SignedInByDefault {
  @RequirePermission(Resource.APP_LOGS, Action.LIST)
  logs(): void {
    // stricter than the class rule
  }

  inherits(): void {
    // uses the class rule
  }
}

function contextFor(controller: object, method: string, role: Role | undefined): ExecutionContext {
  const prototype = (controller as { prototype: Record<string, () => void> }).prototype;
  const request = { auth: role === undefined ? undefined : { user: { role } } };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => prototype[method],
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  it('lets anyone through a public route', () => {
    expect(guard.canActivate(contextFor(OpenRoutes, 'open', undefined))).toBe(true);
  });

  it('lets any role through a signed-in route', () => {
    expect(guard.canActivate(contextFor(OpenRoutes, 'anyone', 'CUSTOMER'))).toBe(true);
  });

  it('allows a role the matrix grants', () => {
    expect(guard.canActivate(contextFor(OpenRoutes, 'usersOnly', 'ADMIN'))).toBe(true);
  });

  it('forbids a role the matrix does not grant', () => {
    expect(
      domainErrorCode(() => guard.canActivate(contextFor(OpenRoutes, 'usersOnly', 'ORGANIZER'))),
    ).toBe('FORBIDDEN');
  });

  it('closes a route that declares no access rule', () => {
    expect(
      domainErrorCode(() => guard.canActivate(contextFor(OpenRoutes, 'undeclared', 'ADMIN'))),
    ).toBe('FORBIDDEN');
  });

  it('lets a method rule override a looser controller rule', () => {
    expect(
      domainErrorCode(() => guard.canActivate(contextFor(SignedInByDefault, 'logs', 'CUSTOMER'))),
    ).toBe('FORBIDDEN');
    expect(guard.canActivate(contextFor(SignedInByDefault, 'logs', 'ADMIN'))).toBe(true);
  });

  it('applies the controller rule to methods without their own', () => {
    expect(guard.canActivate(contextFor(SignedInByDefault, 'inherits', 'CUSTOMER'))).toBe(true);
  });
});

describe('access decorators', () => {
  it('refuse two rules on the same route', () => {
    expect(() => {
      class Conflicting {
        @SignedIn()
        @RequirePermission(Resource.APP_LOGS, Action.LIST)
        logs(): void {
          // conflicting rules
        }
      }
      return Conflicting;
    }).toThrow(/Conflicting access rules on logs/);
  });
});
