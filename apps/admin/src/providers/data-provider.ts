import { REQUEST_ID_HEADER } from '@ers/shared';
import simpleRest from '@refinedev/simple-rest';
import { isAxiosError } from 'axios';

import { apiErrorOf, statusOf } from '../api/errors';
import { API_BASE_URL, http } from '../api/http';

import type {
  BaseRecord,
  CustomParams,
  CustomResponse,
  DataProvider,
  GetManyParams,
  HttpError,
  ValidationErrors,
} from '@refinedev/core';

/** Shown when the request never got an answer (offline, DNS, the API asleep on free hosting). */
export const UNREACHABLE_MESSAGE =
  'The server could not be reached. Check your connection and try again.';
const FAILED_MESSAGE = 'The request failed';
/** Related records fetched at once by getMany, so a long page never floods the API. */
const GET_MANY_BATCH_SIZE = 10;

/** Refine's error shape, plus the requestId the API puts on every error so a user can report it. */
export class AdminHttpError extends Error implements HttpError {
  readonly statusCode: number;
  declare readonly errors?: ValidationErrors;
  declare readonly requestId?: string;

  constructor({
    message,
    statusCode,
    errors,
    requestId,
  }: {
    message: string;
    statusCode: number;
    errors?: ValidationErrors;
    requestId?: string;
  }) {
    super(message);
    this.name = 'AdminHttpError';
    this.statusCode = statusCode;
    // Only present when the API sent them, so callers can test `'errors' in error`.
    Object.assign(
      this,
      errors === undefined ? {} : { errors },
      requestId === undefined ? {} : { requestId },
    );
  }
}

function fieldErrors(details: readonly { field: string; messages: string[] }[]): ValidationErrors {
  const merged = new Map<string, string[]>();
  for (const { field, messages } of details) {
    merged.set(field, [...(merged.get(field) ?? []), ...messages]);
  }
  return Object.fromEntries(merged);
}

function requestIdOf(error: unknown, bodyRequestId: string | undefined): string | undefined {
  if (bodyRequestId !== undefined) {
    return bodyRequestId;
  }
  const header: unknown = isAxiosError(error)
    ? error.response?.headers[REQUEST_ID_HEADER]
    : undefined;
  return typeof header === 'string' ? header : undefined;
}

/**
 * Turns an HTTP failure into the shape Refine expects; field errors light up the matching form
 * inputs. Anything that is not an HTTP failure (a bug, a misuse of the provider) is returned as it
 * is, so it is never disguised as "server unreachable".
 */
export function toHttpError(error: unknown): unknown {
  if (!isAxiosError(error)) {
    return error;
  }
  const body = apiErrorOf(error);
  const statusCode = statusOf(error) ?? 0;
  const requestId = requestIdOf(error, body?.requestId);
  return new AdminHttpError({
    message: body?.message ?? (error.response === undefined ? UNREACHABLE_MESSAGE : FAILED_MESSAGE),
    statusCode,
    ...(body?.details === undefined ? {} : { errors: fieldErrors(body.details) }),
    ...(requestId === undefined ? {} : { requestId }),
  });
}

async function withHttpErrors<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    throw toHttpError(error);
  }
}

/**
 * The API follows the simple-rest conventions (`_start`, `_end`, `_sort`, `_order`, `q`, filters as
 * query parameters, `x-total-count`), so Refine's own provider maps them over our client. The
 * client already adds the /api prefix, hence the empty base here.
 */
const rest = simpleRest('', http);

/** Free-form calls (actions, bulk changes) with query parameters on every method, not just GET. */
async function custom<TData extends BaseRecord = BaseRecord>({
  url,
  method,
  payload,
  query,
  headers,
}: CustomParams): Promise<CustomResponse<TData>> {
  const response = await http.request<TData>({
    url,
    method,
    ...(payload === undefined ? {} : { data: payload }),
    ...(query === undefined ? {} : { params: query }),
    ...(headers === undefined ? {} : { headers }),
  });
  return { data: response.data };
}

/**
 * The API has no "several ids" query, so related records come one by one, de-duplicated and in
 * small batches. A record that fails (deleted, not visible to this role) is left out instead of
 * failing every row that shows the others.
 */
async function getMany({ resource, ids, meta }: GetManyParams): Promise<BaseRecord[]> {
  const unique = [...new Set(ids)];
  const found: BaseRecord[] = [];
  let firstError: unknown;
  for (let start = 0; start < unique.length; start += GET_MANY_BATCH_SIZE) {
    const results = await Promise.allSettled(
      unique
        .slice(start, start + GET_MANY_BATCH_SIZE)
        .map(async (id) => rest.getOne({ resource, id, ...(meta === undefined ? {} : { meta }) })),
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        found.push(result.value.data);
      } else {
        firstError ??= result.reason;
      }
    }
  }
  if (found.length === 0 && firstError instanceof Error) {
    throw firstError;
  }
  return found;
}

export const dataProvider: DataProvider = {
  getApiUrl: () => API_BASE_URL,
  getList: async (params) => withHttpErrors(() => rest.getList(params)),
  getOne: async (params) => withHttpErrors(() => rest.getOne(params)),
  // Records arrive as untyped JSON either way; Refine's generic TData is the caller's promise about their shape.
  getMany: (async (params: GetManyParams) =>
    withHttpErrors(async () => ({ data: await getMany(params) }))) as NonNullable<
    DataProvider['getMany']
  >,
  create: async (params) => withHttpErrors(() => rest.create(params)),
  update: async (params) => withHttpErrors(() => rest.update(params)),
  deleteOne: async (params) => withHttpErrors(() => rest.deleteOne(params)),
  custom: async (params) => withHttpErrors(() => custom(params)),
};
