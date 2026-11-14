import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { TEST_ENV } from '../../../test/helpers/test-env.js';
import { parseConfig } from '../../config/config.schema.js';
import { DomainError } from '../errors/domain-error.js';

import { CsrfGuard } from './csrf.guard.js';
import { SKIP_CSRF_TOKEN_KEY } from './skip-csrf-token.decorator.js';

import type { ExecutionContext } from '@nestjs/common';

const guard = new CsrfGuard(new Reflector(), parseConfig(TEST_ENV));
const CSRF = 'a'.repeat(64);

const AnyController = Object.freeze({});

function regularHandler(): void {
  // Route without metadata.
}

function loginHandler(): void {
  // Route marked with @SkipCsrfToken().
}
Reflect.defineMetadata(SKIP_CSRF_TOKEN_KEY, true, loginHandler);

interface Options {
  headers?: Record<string, string>;
  signedIn?: boolean;
  handler?: () => void;
}

function contextFor(
  method: string,
  { headers = {}, signedIn = false, handler = regularHandler }: Options,
): ExecutionContext {
  const request = {
    method,
    get: (name: string) => headers[name.toLowerCase()],
    auth: signedIn ? { session: { csrfToken: CSRF } } : undefined,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => AnyController,
  } as unknown as ExecutionContext;
}

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof DomainError ? error.code : 'OTHER';
  }
  return undefined;
}

const FOREIGN = { origin: 'https://evil.example' };

describe('CsrfGuard', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])('lets safe %s requests through', (method) => {
    expect(guard.canActivate(contextFor(method, { headers: FOREIGN, signedIn: true }))).toBe(true);
  });

  it('rejects a state-changing request from a foreign origin', () => {
    expect(codeOf(() => guard.canActivate(contextFor('POST', { headers: FOREIGN })))).toBe(
      'CSRF_INVALID',
    );
  });

  it('allows an anonymous request from the admin origin or without an Origin header', () => {
    expect(
      guard.canActivate(contextFor('POST', { headers: { origin: 'http://localhost:5173' } })),
    ).toBe(true);
    expect(guard.canActivate(contextFor('POST', {}))).toBe(true);
  });

  it('rejects a signed-in request without the CSRF header', () => {
    expect(codeOf(() => guard.canActivate(contextFor('DELETE', { signedIn: true })))).toBe(
      'CSRF_INVALID',
    );
  });

  it('rejects a signed-in request with the wrong CSRF token', () => {
    const context = contextFor('PATCH', {
      signedIn: true,
      headers: { 'x-csrf-token': 'b'.repeat(64) },
    });

    expect(codeOf(() => guard.canActivate(context))).toBe('CSRF_INVALID');
  });

  it('accepts a signed-in request with its session CSRF token', () => {
    expect(
      guard.canActivate(contextFor('POST', { signedIn: true, headers: { 'x-csrf-token': CSRF } })),
    ).toBe(true);
  });

  it('does not require the current session token on login and sign-up', () => {
    expect(guard.canActivate(contextFor('POST', { signedIn: true, handler: loginHandler }))).toBe(
      true,
    );
  });

  it('still rejects a foreign origin on login and sign-up', () => {
    const context = contextFor('POST', { signedIn: true, handler: loginHandler, headers: FOREIGN });

    expect(codeOf(() => guard.canActivate(context))).toBe('CSRF_INVALID');
  });
});
