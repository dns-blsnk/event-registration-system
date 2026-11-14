import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { AuthGuard } from './auth.guard.js';
import { CsrfGuard } from './csrf.guard.js';
import { isAuthenticatedSocket, isHttpContext } from './http-context.js';
import { PermissionGuard } from './permission.guard.js';

import type { Config } from '../../config/config.schema.js';
import type { ExecutionContext } from '@nestjs/common';

/** A socket event: it has no HTTP request, so an HTTP guard must not try to read one. */
function socketEvent(data: unknown): ExecutionContext {
  return {
    getType: () => 'ws',
    switchToWs: () => ({ getClient: () => ({ data }) }),
    switchToHttp: () => {
      throw new Error('not an HTTP request');
    },
  } as unknown as ExecutionContext;
}

const authenticated = socketEvent({ userId: 'u1', sessionId: 's1', role: 'ADMIN' });

describe('HTTP-only guards', () => {
  it('tells HTTP requests from socket events', () => {
    expect(isHttpContext({ getType: () => 'http' } as unknown as ExecutionContext)).toBe(true);
    expect(isHttpContext(authenticated)).toBe(false);
  });

  it('let events from a socket that passed the chat handshake through the CSRF and route guards', () => {
    expect(new PermissionGuard(new Reflector()).canActivate(authenticated)).toBe(true);
    expect(new CsrfGuard(new Reflector(), {} as Config).canActivate(authenticated)).toBe(true);
  });

  it.each([
    ['an authenticated socket', authenticated, true],
    ['a socket without handshake data', socketEvent(undefined), false],
    ['a socket with foreign data', socketEvent({ userId: 42 }), false],
    ['an RPC call', { getType: () => 'rpc' } as unknown as ExecutionContext, false],
  ])('lets %s past the session guard: %p', async (_case, context, expected) => {
    const guard = new AuthGuard(new Reflector(), {} as never, {} as Config);

    expect(isAuthenticatedSocket(context)).toBe(expected);
    expect(await guard.canActivate(context)).toBe(expected);
  });
});
