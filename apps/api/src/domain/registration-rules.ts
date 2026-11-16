import { ATTENDANCE_EVENT_STATUSES, ErrorCode, EventStatus, RegistrationStatus } from '@ers/shared';

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

/**
 * A registration can be cancelled only before its session starts. The one exception: staff may
 * clear leftover waitlist places afterwards, which frees no seat and rewrites no attendance.
 */
export function assertCanCancel(
  registration: { status: RegistrationStatus },
  session: TimeRange,
  { byStaff, now }: { byStaff: boolean; now: Date },
): void {
  if (byStaff && registration.status === RegistrationStatus.WAITLISTED) {
    return;
  }
  assertNotStarted(session, now);
}

/** Attendance belongs to events that actually ran: published or completed, never draft or cancelled. */
export function assertCanRecordAttendance(event: { status: EventStatus }): void {
  if (!ATTENDANCE_EVENT_STATUSES.includes(event.status)) {
    throw new DomainError(
      ErrorCode.INVALID_TRANSITION,
      'Attendance can only be recorded for published or completed events',
    );
  }
}

function assertNotStarted(session: TimeRange, now: Date): void {
  if (session.startsAt.getTime() <= now.getTime()) {
    throw new DomainError(ErrorCode.SESSION_STARTED, 'This session has already started');
  }
}
