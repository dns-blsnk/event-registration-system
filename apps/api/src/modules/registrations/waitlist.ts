import { RegistrationStatus } from '@ers/shared';

import { hasScheduleConflict, type ScheduledSession } from '../../domain/registration-rules.js';
import { assertRegistrationTransition } from '../../domain/status-transitions.js';

import { lockCustomers, takeSeat } from './registration-locks.js';

import type { Prisma } from '../../generated/prisma/client.js';

/**
 * The waitlist order: oldest booking first, the id breaking ties. promoteFromWaitlist goes through
 * the waitlist in this order (skipping anyone whose confirmed sessions would overlap), and
 * waitlistPositions numbers the places in it, so both follow this one order.
 */
const WAITLIST_ORDER = [
  { createdAt: 'asc' },
  { id: 'asc' },
] as const satisfies Prisma.RegistrationOrderByWithRelationInput[];

/** 1-based place of each waitlisted registration among its session's waitlist; others get none. */
export async function waitlistPositions(
  db: Pick<Prisma.TransactionClient, 'registration'>,
  rows: readonly { sessionId: string; status: RegistrationStatus }[],
): Promise<Map<string, number>> {
  const sessionIds = [
    ...new Set(
      rows
        .filter((row) => row.status === RegistrationStatus.WAITLISTED)
        .map((row) => row.sessionId),
    ),
  ];
  if (sessionIds.length === 0) {
    return new Map();
  }
  const queue = await db.registration.findMany({
    where: { sessionId: { in: sessionIds }, status: RegistrationStatus.WAITLISTED },
    orderBy: [...WAITLIST_ORDER],
    select: { id: true, sessionId: true },
  });
  const places = new Map<string, number>();
  const lengths = new Map<string, number>();
  for (const entry of queue) {
    const place = (lengths.get(entry.sessionId) ?? 0) + 1;
    lengths.set(entry.sessionId, place);
    places.set(entry.id, place);
  }
  return places;
}

/** Confirmed sessions of a customer, used for the schedule-conflict rule. */
export async function confirmedSessionsOf(
  tx: Prisma.TransactionClient,
  customerId: string,
): Promise<ScheduledSession[]> {
  const rows = await tx.registration.findMany({
    where: { customerId, status: RegistrationStatus.CONFIRMED },
    select: { session: { select: { id: true, startsAt: true, endsAt: true } } },
  });
  return rows.map((row) => row.session);
}

/**
 * Fills free seats from the waitlist, oldest first. Someone whose confirmed sessions would overlap
 * is skipped (they stay waitlisted). Caller must hold the session row lock; this locks the waiting
 * customers plus `alsoLock` (a booker who is not on the waitlist) in one ordered statement.
 * Nobody is promoted into a session that has already started. Returns how many were promoted.
 */
export async function promoteFromWaitlist(
  tx: Prisma.TransactionClient,
  sessionId: string,
  now: Date,
  alsoLock: readonly string[] = [],
): Promise<number> {
  const waitlist = await tx.registration.findMany({
    where: { sessionId, status: RegistrationStatus.WAITLISTED },
    orderBy: [...WAITLIST_ORDER],
    select: { id: true, customerId: true, status: true },
  });
  await lockCustomers(tx, [...waitlist.map((entry) => entry.customerId), ...alsoLock]);
  const session = await tx.session.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.startsAt.getTime() <= now.getTime()) {
    return 0;
  }
  let promoted = 0;
  for (const candidate of waitlist) {
    if (hasScheduleConflict(session, await confirmedSessionsOf(tx, candidate.customerId))) {
      continue;
    }
    assertRegistrationTransition(candidate.status, RegistrationStatus.CONFIRMED, {
      manual: false,
      timing: { startsAt: session.startsAt, now },
    });
    if (!(await takeSeat(tx, sessionId))) {
      break;
    }
    await tx.registration.update({
      where: { id: candidate.id },
      data: { status: RegistrationStatus.CONFIRMED },
    });
    promoted += 1;
  }
  return promoted;
}
