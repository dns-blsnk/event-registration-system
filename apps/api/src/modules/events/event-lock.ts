import { ErrorCode } from '@ers/shared';

import { DomainError } from '../../common/errors/domain-error.js';

import { eventScope } from './event-scope.js';

import type { Event, Prisma, User } from '../../generated/prisma/client.js';

export const EVENT_NOT_FOUND_MESSAGE = 'Event not found';

/**
 * Locks the event row (FOR NO KEY UPDATE) after checking the actor may see it, and returns the
 * current row. Serializes edits and lifecycle actions on one event.
 */
export async function lockScopedEvent(
  tx: Prisma.TransactionClient,
  id: string,
  actor: User,
): Promise<Event> {
  const visible = await tx.event.findFirst({
    where: { id, ...eventScope(actor) },
    select: { id: true },
  });
  if (visible === null) {
    throw new DomainError(ErrorCode.NOT_FOUND, EVENT_NOT_FOUND_MESSAGE);
  }
  await tx.$queryRaw`SELECT id FROM events WHERE id = ${id}::uuid FOR NO KEY UPDATE`;
  return tx.event.findUniqueOrThrow({ where: { id } });
}

/**
 * Locks every session row of the event. Bookings update the session row (atomic seat counter), so
 * they wait for a running cancel or delete and then see its result.
 */
export async function lockEventSessions(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM sessions WHERE event_id = ${eventId}::uuid ORDER BY id FOR UPDATE`;
}
