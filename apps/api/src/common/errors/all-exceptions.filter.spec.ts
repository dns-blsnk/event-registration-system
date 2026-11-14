import { describe, expect, it, vi } from 'vitest';

import { AllExceptionsFilter } from './all-exceptions.filter.js';

import type { AppLogService } from '../../modules/app-logs/app-log.service.js';
import type { ArgumentsHost } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';

const REQUEST = {
  id: 'req-1',
  method: 'POST',
  ip: '10.0.0.1',
  get: () => 'test-agent',
  originalUrl: '/api/x',
};

function httpHost(response: Record<string, unknown>): ArgumentsHost {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => REQUEST, getResponse: () => response }),
  } as unknown as ArgumentsHost;
}

function createFilter(): {
  filter: AllExceptionsFilter;
  error: ReturnType<typeof vi.fn>;
  record: ReturnType<typeof vi.fn>;
} {
  const error = vi.fn();
  const record = vi.fn();
  const filter = new AllExceptionsFilter(
    { error, setContext: vi.fn() } as unknown as PinoLogger,
    { record } as unknown as AppLogService,
  );
  return { filter, error, record };
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

  it('records a server error in the journal with the real cause', () => {
    const { filter, record } = createFilter();

    filter.catch(new Error('db pool exhausted'), httpHost(jsonResponse()));

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'ERROR',
        category: 'ERROR',
        message: 'db pool exhausted',
        statusCode: 500,
        requestId: 'req-1',
        method: 'POST',
        ip: '10.0.0.1',
        userAgent: 'test-agent',
        stack: expect.stringContaining('db pool exhausted'),
      }),
    );
  });

  it.each([401, 403, 429])(
    'records a %i response as a security event without a stack',
    (status) => {
      const { filter, record, error } = createFilter();

      filter.catch(Object.assign(new Error('denied'), { status }), httpHost(jsonResponse()));

      expect(error).not.toHaveBeenCalled();
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'WARN', category: 'SECURITY', statusCode: status }),
      );
      expect(record.mock.calls[0]?.[0]).not.toHaveProperty('stack');
    },
  );

  it.each([400, 404, 409])('does not journal an ordinary %i client error', (status) => {
    const { filter, record, error } = createFilter();

    filter.catch(Object.assign(new Error('client'), { status }), httpHost(jsonResponse()));

    expect(error).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
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
