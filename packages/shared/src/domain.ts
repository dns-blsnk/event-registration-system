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

/** A session counts as "almost full" from this share of seats taken. */
export const ALMOST_FULL_RATIO = 0.9;
