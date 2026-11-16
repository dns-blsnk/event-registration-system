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

/** What the schedule-conflict rule needs of a session; booking and promotion read the same. */
const SCHEDULE_SELECT = {
  id: true,
  startsAt: true,
  endsAt: true,
} as const satisfies Prisma.SessionSelect;

/** Confirmed sessions of a customer, used for the schedule-conflict rule. */
export async function confirmedSessionsOf(
  tx: Prisma.TransactionClient,
  customerId: string,
): Promise<ScheduledSession[]> {
  const rows = await tx.registration.findMany({
    where: { customerId, status: RegistrationStatus.CONFIRMED },
    select: { session: { select: SCHEDULE_SELECT } },
  });
  return rows.map((row) => row.session);
}

/**
 * The confirmed sessions of several customers that overlap `session`, in one query, grouped by
 * customer (those with none are absent). The filter mirrors `overlaps` (half-open ranges) only to
 * keep the rows few; `hasScheduleConflict` still makes the decision.
 */
async function overlappingSessionsByCustomer(
  tx: Prisma.TransactionClient,
  customerIds: readonly string[],
  session: ScheduledSession,
): Promise<Map<string, ScheduledSession[]>> {
  const rows = await tx.registration.findMany({
    where: {
      customerId: { in: [...customerIds] },
      status: RegistrationStatus.CONFIRMED,
      session: { startsAt: { lt: session.endsAt }, endsAt: { gt: session.startsAt } },
    },
    select: { customerId: true, session: { select: SCHEDULE_SELECT } },
  });
  const byCustomer = new Map<string, ScheduledSession[]>();
  for (const { customerId, session: confirmed } of rows) {
    const sessions = byCustomer.get(customerId) ?? [];
    if (sessions.length === 0) byCustomer.set(customerId, sessions);
    sessions.push(confirmed);
  }
  return byCustomer;
}

/**
 * Fills free seats from the waitlist, oldest first. Someone whose confirmed sessions would overlap
 * is skipped (they stay waitlisted). Caller must hold the session row lock, so its seat count
 * cannot change here. `alsoLock` (a booker who is not on the waitlist) is always locked; the
 * waiting customers are locked with it, in one ordered statement, only when a seat is free.
 * Nobody is promoted into a session that has already started. Returns how many were promoted.
 */
export async function promoteFromWaitlist(
  tx: Prisma.TransactionClient,
  sessionId: string,
  now: Date,
  alsoLock: readonly string[] = [],
): Promise<number> {
  const session = await tx.session.findUniqueOrThrow({ where: { id: sessionId } });
  const hasStarted = session.startsAt.getTime() <= now.getTime();
  // Most bookings land in a full session: then nobody is promoted, so the waitlist is neither read
  // nor locked, which would hold up those customers' bookings elsewhere.
  if (hasStarted || session.confirmedCount >= session.capacity) {
    await lockCustomers(tx, alsoLock);
    return 0;
  }
  const waitlist = await tx.registration.findMany({
    where: { sessionId, status: RegistrationStatus.WAITLISTED },
    orderBy: [...WAITLIST_ORDER],
    select: { id: true, customerId: true, status: true },
  });
  const waiting = waitlist.map((entry) => entry.customerId);
  await lockCustomers(tx, [...waiting, ...alsoLock]);
  if (waitlist.length === 0) return 0;
  // One query for everyone waiting instead of one per candidate. Promoting one candidate never
  // changes another's conflicts: a customer is on a session's waitlist at most once.
  const conflicts = await overlappingSessionsByCustomer(tx, waiting, session);
  let promoted = 0;
  for (const candidate of waitlist) {
    if (hasScheduleConflict(session, conflicts.get(candidate.customerId) ?? [])) {
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
