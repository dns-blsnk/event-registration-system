/** Event lifecycle. Values match the Prisma `EventStatus` enum. */
export const EventStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const EVENT_STATUSES: readonly EventStatus[] = Object.values(EventStatus);

/**
 * Allowed next event statuses; anything not listed is forbidden and final states have none. The API
 * enforces it (plus timing rules); the admin uses it to offer only actions that can succeed.
 */
export const EVENT_TRANSITIONS: Readonly<Record<EventStatus, readonly EventStatus[]>> = {
  [EventStatus.DRAFT]: [EventStatus.PUBLISHED, EventStatus.CANCELLED],
  [EventStatus.PUBLISHED]: [EventStatus.COMPLETED, EventStatus.CANCELLED],
  [EventStatus.COMPLETED]: [],
  [EventStatus.CANCELLED]: [],
};

/** Completed and cancelled events are history: their details, banner and sessions no longer change. */
export const LOCKED_EVENT_STATUSES: readonly EventStatus[] = [
  EventStatus.COMPLETED,
  EventStatus.CANCELLED,
];

export function isEventLocked(status: EventStatus): boolean {
  return LOCKED_EVENT_STATUSES.includes(status);
}

export const SessionPhase = {
  UPCOMING: 'UPCOMING',
  RUNNING: 'RUNNING',
  ENDED: 'ENDED',
} as const;
export type SessionPhase = (typeof SessionPhase)[keyof typeof SessionPhase];

/**
 * Where a session is in time. Upcoming sessions change freely; once running, their time and
 * capacity are history; once ended, nothing about them changes.
 */
export function sessionPhase(session: { startsAt: Date; endsAt: Date }, now: Date): SessionPhase {
  if (now.getTime() >= session.endsAt.getTime()) return SessionPhase.ENDED;
  if (now.getTime() >= session.startsAt.getTime()) return SessionPhase.RUNNING;
  return SessionPhase.UPCOMING;
}

export interface EventTiming {
  startsAt: Date;
  endsAt: Date;
  now: Date;
}

const EVENT_TIMING_RULES: Partial<
  Record<EventStatus, (timing: EventTiming) => string | undefined>
> = {
  // Publishing a past event would open bookings for something that already happened.
  [EventStatus.PUBLISHED]: ({ startsAt, now }) =>
    now.getTime() >= startsAt.getTime()
      ? 'An event that has already started cannot be published'
      : undefined,
  // Completing early would close the event for good.
  [EventStatus.COMPLETED]: ({ startsAt, now }) =>
    now.getTime() < startsAt.getTime()
      ? 'An event cannot be completed before it starts'
      : undefined,
  // Cancelling a finished event would rewrite its attendance history; complete it instead.
  [EventStatus.CANCELLED]: ({ endsAt, now }) =>
    now.getTime() >= endsAt.getTime()
      ? 'An event that has already ended cannot be cancelled'
      : undefined,
};

/** Why moving an event to `to` is not possible at this moment, or undefined when timing allows it. */
export function eventTimingProblem(to: EventStatus, timing: EventTiming): string | undefined {
  return EVENT_TIMING_RULES[to]?.(timing);
}

/** Registration lifecycle. Values match the Prisma `RegistrationStatus` enum. */
export const RegistrationStatus = {
  CONFIRMED: 'CONFIRMED',
  WAITLISTED: 'WAITLISTED',
  CANCELLED: 'CANCELLED',
  ATTENDED: 'ATTENDED',
} as const;

export type RegistrationStatus = (typeof RegistrationStatus)[keyof typeof RegistrationStatus];

export const REGISTRATION_STATUSES: readonly RegistrationStatus[] =
  Object.values(RegistrationStatus);

/**
 * Registrations that hold, or held, a place in a session. A customer with one of these cannot book
 * the session again; only after cancelling can they book it anew (the same row is reused).
 */
export const HELD_REGISTRATION_STATUSES: readonly RegistrationStatus[] = [
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.WAITLISTED,
  RegistrationStatus.ATTENDED,
];

/** A session counts as "almost full" from this share of seats taken. */
export const ALMOST_FULL_RATIO = 0.9;

/** What a customer may give up themselves: a seat or a waitlist place, never history. */
const CUSTOMER_CANCELLABLE_STATUSES: readonly RegistrationStatus[] = [
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.WAITLISTED,
];

/**
 * A customer can cancel their own seat or waitlist place until the session starts. The API checks
 * the same rule (and the status transition) before cancelling; the admin uses it to offer the button.
 */
export function canCustomerCancel(
  registration: { status: RegistrationStatus },
  session: { startsAt: Date; endsAt: Date },
  now: Date,
): boolean {
  return (
    CUSTOMER_CANCELLABLE_STATUSES.includes(registration.status) &&
    sessionPhase(session, now) === SessionPhase.UPCOMING
  );
}
