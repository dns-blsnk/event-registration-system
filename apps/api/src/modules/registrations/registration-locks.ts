import { ErrorCode } from '@ers/shared';

import { DomainError } from '../../common/errors/domain-error.js';

import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Lock order used everywhere a booking can change: event row, then session rows, then customer
 * rows (several customers always in id order). The session lock serializes seats in one session;
 * a customer lock serializes the schedule-conflict check for that person across sessions. Keeping
 * one order means two transactions can never wait on each other.
 */
export async function lockSession(tx: Prisma.TransactionClient, sessionId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
}

export async function lockCustomers(
  tx: Prisma.TransactionClient,
  customerIds: readonly string[],
): Promise<void> {
  if (customerIds.length === 0) {
    return;
  }
  await tx.$queryRaw`
    SELECT id FROM users WHERE id = ANY(${[...new Set(customerIds)]}::uuid[])
    ORDER BY id FOR NO KEY UPDATE`;
}

/** Takes one seat only if one is free. Returns false when the session is full. */
export async function takeSeat(tx: Prisma.TransactionClient, sessionId: string): Promise<boolean> {
  const updated = await tx.$executeRaw`
    UPDATE sessions SET confirmed_count = confirmed_count + 1
    WHERE id = ${sessionId}::uuid AND confirmed_count < capacity`;
  return updated === 1;
}

export async function releaseSeat(tx: Prisma.TransactionClient, sessionId: string): Promise<void> {
  await tx.$executeRaw`
    UPDATE sessions SET confirmed_count = confirmed_count - 1
    WHERE id = ${sessionId}::uuid AND confirmed_count > 0`;
}

const REGISTRATION_WITH_SESSION = {
  session: { include: { event: true } },
} satisfies Prisma.RegistrationInclude;

export type LockedRegistration = Prisma.RegistrationGetPayload<{
  include: typeof REGISTRATION_WITH_SESSION;
}>;

/**
 * Checks the registration is within `scope` (anything else is a 404), locks its session row and
 * re-reads it under that lock, with its session and event.
 */
export async function lockVisibleRegistration(
  tx: Prisma.TransactionClient,
  id: string,
  scope: Prisma.RegistrationWhereInput,
): Promise<LockedRegistration> {
  const visible = await tx.registration.findFirst({
    where: { AND: [{ id }, scope] },
    select: { sessionId: true },
  });
  if (visible === null) {
    throw new DomainError(ErrorCode.NOT_FOUND, 'Registration not found');
  }
  await lockSession(tx, visible.sessionId);
  return tx.registration.findUniqueOrThrow({ where: { id }, include: REGISTRATION_WITH_SESSION });
}
