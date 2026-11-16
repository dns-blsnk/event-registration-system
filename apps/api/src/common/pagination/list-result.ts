import { TOTAL_COUNT_HEADER } from '@ers/shared';

import type { Response } from 'express';

export interface ListResult<T> {
  items: T[];
  total: number;
}

/** Sends a page in the shape Refine simple-rest expects: JSON array + total in a header. */
export function sendList<T>(response: Response, result: ListResult<T>): T[] {
  response.setHeader(TOTAL_COUNT_HEADER, String(result.total));
  return result.items;
}
