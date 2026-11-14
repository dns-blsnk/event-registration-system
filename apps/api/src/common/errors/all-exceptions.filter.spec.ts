import { describe, expect, it, vi } from 'vitest';

import { AllExceptionsFilter } from './all-exceptions.filter.js';

import type { ArgumentsHost } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';

function httpHost(response: Record<string, unknown>): ArgumentsHost {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ id: 'req-1' }), getResponse: () => response }),
  } as unknown as ArgumentsHost;
}

function createFilter(): { filter: AllExceptionsFilter; error: ReturnType<typeof vi.fn> } {
  const error = vi.fn();
  return { filter: new AllExceptionsFilter({ error } as unknown as PinoLogger), error };
}

function jsonResponse(): {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  headersSent: boolean;
} {
  const response = { status: vi.fn(), json: vi.fn(), headersSent: false };
  response.status.mockReturnValue(response);
  return response;
}

describe('AllExceptionsFilter', () => {
  it('logs a server error once with its stack and sends the generic body', () => {
    const { filter, error } = createFilter();
    const response = jsonResponse();
    const crash = new Error('boom');

    filter.catch(crash, httpHost(response));

    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(
      { err: crash, code: 'INTERNAL_ERROR', requestId: 'req-1' },
      'request failed',
    );
    expect(response.status).toHaveBeenCalledWith(500);
  });

  it('does not log client errors', () => {
    const { filter, error } = createFilter();

    filter.catch(Object.assign(new Error('bad json'), { status: 400 }), httpHost(jsonResponse()));

    expect(error).not.toHaveBeenCalled();
  });

  it('only ends the response when headers were already sent', () => {
    const { filter } = createFilter();
    const response = { ...jsonResponse(), headersSent: true, end: vi.fn() };

    filter.catch(new Error('late'), httpHost(response));

    expect(response.end).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('rethrows outside HTTP so WebSocket filters can handle it', () => {
    const { filter } = createFilter();
    const wsError = new Error('ws');

    expect(() => {
      filter.catch(wsError, { getType: () => 'ws' } as unknown as ArgumentsHost);
    }).toThrow(wsError);
  });
});
