import { describe, expect, it, vi } from 'vitest';

import { requestIdMiddleware, requestIdOf } from './request-id.js';

import type { ServerResponse } from 'node:http';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function run(incoming: Record<string, unknown> = {}): {
  req: { id?: unknown };
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  const req = { headers: incoming } as { id?: unknown; headers: Record<string, unknown> };
  const res = {
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  } as unknown as ServerResponse;
  requestIdMiddleware(req as never, res, vi.fn());
  return { req, headers };
}

describe('requestIdMiddleware', () => {
  it('assigns a UUID to the request and the response header', () => {
    const { req, headers } = run();

    expect(req.id).toMatch(UUID);
    expect(headers['x-request-id']).toBe(req.id);
  });

  it('ignores a client-supplied request id', () => {
    const { req } = run({ 'x-request-id': 'forged' });

    expect(req.id).not.toBe('forged');
  });

  it('gives every request a different id', () => {
    expect(run().req.id).not.toBe(run().req.id);
  });

  it('calls the next middleware', () => {
    const next = vi.fn();
    requestIdMiddleware({} as never, { setHeader: vi.fn() } as never, next);

    expect(next).toHaveBeenCalledOnce();
  });
});

describe('requestIdOf', () => {
  it('returns the assigned id', () => {
    expect(requestIdOf({ id: 'abc' } as never)).toBe('abc');
  });

  it('falls back to "unknown" when no id was assigned', () => {
    expect(requestIdOf({} as never)).toBe('unknown');
  });
});
