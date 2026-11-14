import {
  ErrorCode,
  EVENT_TRANSITIONS,
  eventTimingProblem,
  EventStatus,
  RegistrationStatus,
  type EventTiming,
} from '@ers/shared';

import { DomainError } from '../common/errors/domain-error.js';

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
  /** When the event ends; needed for cancellation. */
  endsAt?: Date;
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

export function assertEventTransition(
  from: EventStatus,
  to: EventStatus,
  timing: EventTiming,
): void {
  if (!canTransitionEvent(from, to)) {
    throw new DomainError(ErrorCode.INVALID_TRANSITION, `An event cannot go from ${from} to ${to}`);
  }
  const problem = eventTimingProblem(to, timing);
  if (problem !== undefined) {
    throw new DomainError(ErrorCode.INVALID_TRANSITION, problem);
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

const LOCKED_EVENT_STATUSES: readonly EventStatus[] = [
  EventStatus.COMPLETED,
  EventStatus.CANCELLED,
];

/** Completed and cancelled events are history: their details and banner no longer change. */
export function assertEventEditable(event: { status: EventStatus }): void {
  if (LOCKED_EVENT_STATUSES.includes(event.status)) {
    throw new DomainError(ErrorCode.CONFLICT, 'Completed or cancelled events cannot be edited');
  }
}
