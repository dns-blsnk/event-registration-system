import {
  ErrorCode,
  EVENT_TRANSITIONS,
  eventTimingProblem,
  isEventLocked,
  RegistrationStatus,
  STAFF_REGISTRATION_TRANSITIONS,
} from '@ers/shared';

import { DomainError } from '../common/errors/domain-error.js';

import type { EventStatus, EventTiming } from '@ers/shared';

/**
 * What the system may do on top: promote from the waitlist when a seat frees up. Staff cannot use it
 * to overbook a session.
 */
const SYSTEM_REGISTRATION_TRANSITIONS: Readonly<
  Record<RegistrationStatus, readonly RegistrationStatus[]>
> = {
  ...STAFF_REGISTRATION_TRANSITIONS,
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
  const table = manual ? STAFF_REGISTRATION_TRANSITIONS : SYSTEM_REGISTRATION_TRANSITIONS;
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

/** Completed and cancelled events are history: their details and banner no longer change. */
export function assertEventEditable(event: { status: EventStatus }): void {
  if (isEventLocked(event.status)) {
    throw new DomainError(ErrorCode.CONFLICT, 'Completed or cancelled events cannot be edited');
  }
}
