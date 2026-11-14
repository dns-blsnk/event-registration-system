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
