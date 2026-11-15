import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { mockHttp } from '@/test/http-mock';

import { AdminHttpError, dataProvider, toHttpError, UNREACHABLE_MESSAGE } from './data-provider';

describe('dataProvider', () => {
  it('lists with the API paging, sorting, search and filter parameters and reads the total', async () => {
    const { calls } = mockHttp([
      { method: 'get', url: '/events', status: 200, body: [{ id: 'e1' }] },
    ]);

    const result = await dataProvider.getList({
      resource: 'events',
      pagination: { currentPage: 2, pageSize: 25 },
      sorters: [{ field: 'startsAt', order: 'desc' }],
      filters: [
        { field: 'status', operator: 'eq', value: 'PUBLISHED' },
        { field: 'q', operator: 'eq', value: 'summit' },
      ],
    });

    expect(result.data).toEqual([{ id: 'e1' }]);
    const url = new URL(String(calls[0]?.url), 'http://admin.test');
    expect(url.pathname).toBe('/events');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      _start: '25',
      _end: '50',
      _sort: 'startsAt',
      _order: 'desc',
      status: 'PUBLISHED',
      q: 'summit',
    });
  });

  it('skips a related record that cannot be loaded and keeps the others', async () => {
    mockHttp([
      { method: 'get', url: '/tags/a', status: 200, body: { id: 'a' } },
      { method: 'get', url: '/tags/b', status: 404 },
    ]);

    const result = await dataProvider.getMany?.({ resource: 'tags', ids: ['a', 'b', 'a'] });

    expect(result?.data).toEqual([{ id: 'a' }]);
  });

  it('fails getMany only when no record could be loaded', async () => {
    mockHttp([{ method: 'get', url: '/tags/x', status: 403 }]);

    await expect(dataProvider.getMany?.({ resource: 'tags', ids: ['x'] })).rejects.toBeInstanceOf(
      AdminHttpError,
    );
  });

  it('sends query parameters with custom calls of any method', async () => {
    const { calls } = mockHttp([
      { method: 'post', url: '/registrations/bulk-status', status: 200, body: { results: [] } },
    ]);

    await dataProvider.custom?.({
      url: '/registrations/bulk-status',
      method: 'post',
      payload: { ids: ['r1'], status: 'CANCELLED' },
      query: { eventId: 'e1' },
    });

    expect(calls[0]?.params).toEqual({ eventId: 'e1' });
    expect(JSON.parse(String(calls[0]?.data))).toEqual({ ids: ['r1'], status: 'CANCELLED' });
  });

  it('reports the real API base url', () => {
    expect(dataProvider.getApiUrl()).toBe('/api');
  });

  it('merges several messages for the same field', async () => {
    mockHttp([
      {
        method: 'post',
        url: '/events',
        status: 400,
        body: {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          message: 'Invalid',
          details: [
            { field: 'endsAt', messages: ['must be a date'] },
            { field: 'endsAt', messages: ['must be after the start'] },
          ],
          requestId: 'r',
        },
      },
    ]);

    const error = (await dataProvider
      .create({ resource: 'events', variables: {} })
      .catch((caught: unknown) => caught)) as AdminHttpError;

    expect(error.errors).toEqual({ endsAt: ['must be a date', 'must be after the start'] });
  });

  it('fetches several records one by one because the API has no id-list query', async () => {
    const { calls } = mockHttp([
      { method: 'get', url: '/tags/a', status: 200, body: { id: 'a' } },
      { method: 'get', url: '/tags/b', status: 200, body: { id: 'b' } },
    ]);

    const result = await dataProvider.getMany?.({ resource: 'tags', ids: ['a', 'b'] });

    expect(result?.data).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(calls.map((call) => call.url)).toEqual(['/tags/a', '/tags/b']);
  });

  it('turns API field errors into form errors and keeps the request id', async () => {
    mockHttp([
      {
        method: 'post',
        url: '/tags',
        status: 409,
        body: {
          statusCode: 409,
          code: 'CONFLICT',
          message: 'A tag with this name already exists',
          details: [{ field: 'name', messages: ['A tag with this name already exists'] }],
          requestId: 'req-1',
        },
      },
    ]);

    const error: unknown = await dataProvider
      .create({ resource: 'tags', variables: { name: 'AI' } })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AdminHttpError);
    const { message, statusCode, errors, requestId } = error as AdminHttpError;
    expect({ message, statusCode, errors, requestId }).toEqual({
      message: 'A tag with this name already exists',
      statusCode: 409,
      errors: { name: ['A tag with this name already exists'] },
      requestId: 'req-1',
    });
  });
});

describe('toHttpError', () => {
  it('explains a request that never got an answer', () => {
    const error = toHttpError(new AxiosError('Network Error')) as AdminHttpError;

    expect([error.message, error.statusCode, 'errors' in error]).toEqual([
      UNREACHABLE_MESSAGE,
      0,
      false,
    ]);
  });

  it('leaves programming errors as they are instead of blaming the network', () => {
    const bug = new TypeError('cannot read properties of undefined');

    expect(toHttpError(bug)).toBe(bug);
  });

  it('takes the request id from the response header when there is no error body', () => {
    const headers = new AxiosHeaders({ 'x-request-id': 'req-9' });
    const error = toHttpError(
      new AxiosError('Payload Too Large', '413', undefined, undefined, {
        data: 'too large',
        status: 413,
        statusText: '',
        headers,
        config: { headers },
      }),
    ) as AdminHttpError;

    expect([error.statusCode, error.requestId]).toEqual([413, 'req-9']);
  });

  it.each([
    [500, 'Server error (request id: req-5)'],
    [503, 'Server error (request id: req-5)'],
    [409, 'Server error'],
  ])(
    'adds the request id to the message of a %i answer only when the server failed',
    (status, message) => {
      const headers = new AxiosHeaders();
      const error = toHttpError(
        new AxiosError('failed', String(status), undefined, undefined, {
          data: { statusCode: status, code: 'X', message: 'Server error', requestId: 'req-5' },
          status,
          statusText: '',
          headers,
          config: { headers },
        }),
      ) as AdminHttpError;

      expect(error.message).toBe(message);
      expect(error.requestId).toBe('req-5');
    },
  );
});
