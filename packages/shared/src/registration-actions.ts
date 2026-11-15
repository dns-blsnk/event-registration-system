import { EventStatus, RegistrationStatus } from './domain.js';

import type { BulkTargetStatus } from './registrations.js';

/** What staff may do by hand (admin and bulk actions); the system may also promote the waitlist. */
export const STAFF_REGISTRATION_TRANSITIONS: Readonly<
  Record<RegistrationStatus, readonly RegistrationStatus[]>
> = {
  [RegistrationStatus.CONFIRMED]: [RegistrationStatus.CANCELLED, RegistrationStatus.ATTENDED],
  [RegistrationStatus.WAITLISTED]: [RegistrationStatus.CANCELLED],
  [RegistrationStatus.CANCELLED]: [],
  [RegistrationStatus.ATTENDED]: [],
};

/** Attendance belongs to events that actually ran: published or completed, never draft or cancelled. */
export const ATTENDANCE_EVENT_STATUSES: readonly EventStatus[] = [
  EventStatus.PUBLISHED,
  EventStatus.COMPLETED,
];

const ALREADY: Readonly<Record<RegistrationStatus, string>> = {
  [RegistrationStatus.CONFIRMED]: 'already confirmed',
  [RegistrationStatus.WAITLISTED]: 'waitlisted, so there is no seat to attend',
  [RegistrationStatus.CANCELLED]: 'already cancelled',
  [RegistrationStatus.ATTENDED]: 'already attended',
};

/** What a staff bulk action needs to know about one registration. */
export interface StaffActionTarget {
  status: RegistrationStatus;
  sessionStartsAt: Date;
  eventStatus: EventStatus;
}

/**
 * Why staff cannot apply a bulk action to this registration right now, or undefined when they can:
 * attendance only from a seat, in an event that ran, once the session has started; cancelling only
 * before it starts, except leftover waitlist places. The API applies the same transitions and
 * event statuses (imported from here) and still checks every row with the server clock.
 */
export function staffActionRefusal(
  registration: StaffActionTarget,
  target: BulkTargetStatus,
  now: Date,
): string | undefined {
  if (!STAFF_REGISTRATION_TRANSITIONS[registration.status].includes(target)) {
    return ALREADY[registration.status];
  }
  if (
    target === RegistrationStatus.ATTENDED &&
    !ATTENDANCE_EVENT_STATUSES.includes(registration.eventStatus)
  ) {
    return 'the event did not run';
  }
  const hasStarted = registration.sessionStartsAt.getTime() <= now.getTime();
  if (target === RegistrationStatus.ATTENDED && !hasStarted) {
    return 'the session has not started yet';
  }
  const isLeftoverWaitlist = registration.status === RegistrationStatus.WAITLISTED;
  if (target === RegistrationStatus.CANCELLED && hasStarted && !isLeftoverWaitlist) {
    return 'the session has already started';
  }
  return undefined;
}
