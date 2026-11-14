import { ErrorCode, EventStatus } from '@ers/shared';

import { DomainError } from '../common/errors/domain-error.js';

import { overlaps, type TimeRange } from './schedule.js';

export interface ScheduledSession extends TimeRange {
  id: string;
}

/** Customers can only book published events and sessions that have not started yet. */
export function assertCanRegister(
  event: { status: EventStatus },
  session: TimeRange,
  now: Date,
): void {
  if (event.status !== EventStatus.PUBLISHED) {
    throw new DomainError(ErrorCode.EVENT_NOT_OPEN, 'This event is not open for registration');
  }
  assertNotStarted(session, now);
}

/** True when the candidate overlaps another of the customer's confirmed sessions (itself excluded). */
export function hasScheduleConflict(
  candidate: ScheduledSession,
  confirmedSessions: readonly ScheduledSession[],
): boolean {
  return confirmedSessions.some(
    (session) => session.id !== candidate.id && overlaps(candidate, session),
  );
}

/**
 * A customer cannot hold confirmed seats in two sessions that run at the same time. Checked when
 * booking a seat and again before promoting someone from the waitlist.
 */
export function assertNoScheduleConflict(
  candidate: ScheduledSession,
  confirmedSessions: readonly ScheduledSession[],
): void {
  if (hasScheduleConflict(candidate, confirmedSessions)) {
    throw new DomainError(
      ErrorCode.SCHEDULE_CONFLICT,
      'You already have a confirmed session at this time',
    );
  }
}

/** Customers can give up a seat or a waitlist place only before the session starts. */
export function assertCanCancel(session: TimeRange, now: Date): void {
  assertNotStarted(session, now);
}

function assertNotStarted(session: TimeRange, now: Date): void {
  if (session.startsAt.getTime() <= now.getTime()) {
    throw new DomainError(ErrorCode.SESSION_STARTED, 'This session has already started');
  }
}
