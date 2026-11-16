import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { vi } from 'vitest';

import { http } from '@/shared/api';

export interface MockRoute {
  method: string;
  url: string;
  status: number;
  body?: unknown;
}

/** Routes requests of the shared client to canned responses and records what was sent. */
export function mockHttp(routes: MockRoute[]): { calls: InternalAxiosRequestConfig[] } {
  const calls: InternalAxiosRequestConfig[] = [];
  const queue = [...routes];
  const adapter: AxiosAdapter = (config) => {
    calls.push(config);
    const index = queue.findIndex(
      (route) =>
        route.method === (config.method ?? 'get').toLowerCase() &&
        route.url === config.url?.split('?')[0],
    );
    const route = index === -1 ? undefined : queue.splice(index, 1)[0];
    const response: AxiosResponse = {
      data: route?.body,
      status: route?.status ?? 404,
      statusText: '',
      headers: new AxiosHeaders(),
      config,
    };
    if (response.status >= 400) {
      return Promise.reject(
        new AxiosError('failed', String(response.status), config, undefined, response),
      );
    }
    return Promise.resolve(response);
  };
  http.defaults.adapter = vi.fn(adapter);
  return { calls };
}
