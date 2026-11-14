import { randomUUID } from 'node:crypto';

import { REQUEST_ID_HEADER } from '@ers/shared';

import type { NextFunction } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';

type RequestWithId = IncomingMessage & { id?: unknown };

/**
 * Gives every request a server-generated id before any other middleware runs, so even body-parser
 * failures carry one. A client-supplied id is ignored because it could be spoofed.
 */
export function requestIdMiddleware(
  req: RequestWithId,
  res: ServerResponse,
  next: NextFunction,
): void {
  const id = randomUUID();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}

/** The id assigned by requestIdMiddleware ('unknown' only if the middleware was bypassed). */
export function requestIdOf(req: RequestWithId): string {
  return typeof req.id === 'string' ? req.id : 'unknown';
}
