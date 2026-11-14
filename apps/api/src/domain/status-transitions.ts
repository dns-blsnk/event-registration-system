import { ErrorCode, EventStatus, RegistrationStatus } from '@ers/shared';

import { DomainError } from '../common/errors/domain-error.js';

/** Allowed next statuses. Anything not listed is forbidden; terminal states have none. */
const EVENT_TRANSITIONS: Readonly<Record<EventStatus, readonly EventStatus[]>> = {
  [EventStatus.DRAFT]: [EventStatus.PUBLISHED, EventStatus.CANCELLED],
  [EventStatus.PUBLISHED]: [EventStatus.COMPLETED, EventStatus.CANCELLED],
  [EventStatus.COMPLETED]: [],
  [EventStatus.CANCELLED]: [],
};

/** What staff may do by hand (admin and bulk actions). */
const MANUAL_REGISTRATION_TRANSITIONS: Readonly<
  Record<RegistrationStatus, readonly RegistrationStatus[]>
> = {
  [RegistrationStatus.CONFIRMED]: [RegistrationStatus.CANCELLED, RegistrationStatus.ATTENDED],
  [RegistrationStatus.WAITLISTED]: [RegistrationStatus.CANCELLED],
  [RegistrationStatus.CANCELLED]: [],
  [RegistrationStatus.ATTENDED]: [],
};

/**
 * What the system may do on top: promote from the waitlist when a seat frees up. Staff cannot use it
 * to overbook a session.
 */
const SYSTEM_REGISTRATION_TRANSITIONS: Readonly<
  Record<RegistrationStatus, readonly RegistrationStatus[]>
> = {
  ...MANUAL_REGISTRATION_TRANSITIONS,
  [RegistrationStatus.WAITLISTED]: [RegistrationStatus.CANCELLED, RegistrationStatus.CONFIRMED],
};

export interface TransitionTiming {
  /** When the event or session starts. */
  startsAt: Date;
  now: Date;
}

export function canTransitionEvent(from: EventStatus, to: EventStatus): boolean {
  return EVENT_TRANSITIONS[from].includes(to);
}

export function canTransitionRegistration(
  from: RegistrationStatus,
  to: RegistrationStatus,
  { manual }: { manual: boolean },
): boolean {
  const table = manual ? MANUAL_REGISTRATION_TRANSITIONS : SYSTEM_REGISTRATION_TRANSITIONS;
  return table[from].includes(to);
}

/** An event can only be completed once it has started; completing early would close it for good. */
export function assertEventTransition(
  from: EventStatus,
  to: EventStatus,
  timing: TransitionTiming,
): void {
  if (!canTransitionEvent(from, to)) {
    throw new DomainError(ErrorCode.INVALID_TRANSITION, `An event cannot go from ${from} to ${to}`);
  }
  if (to === EventStatus.COMPLETED && timing.now.getTime() < timing.startsAt.getTime()) {
    throw new DomainError(
      ErrorCode.INVALID_TRANSITION,
      'An event cannot be completed before it starts',
    );
  }
}

/** Attendance can only be recorded once the session has started. */
export function assertRegistrationTransition(
  from: RegistrationStatus,
  to: RegistrationStatus,
  { manual, timing }: { manual: boolean; timing: TransitionTiming },
): void {
  if (!canTransitionRegistration(from, to, { manual })) {
    throw new DomainError(
      ErrorCode.INVALID_TRANSITION,
      `A registration cannot go from ${from} to ${to}`,
    );
  }
  if (to === RegistrationStatus.ATTENDED && timing.now.getTime() < timing.startsAt.getTime()) {
    throw new DomainError(
      ErrorCode.INVALID_TRANSITION,
      'Attendance cannot be recorded before the session starts',
    );
  }
}
