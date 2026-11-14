import { EVENT_STATUSES, REGISTRATION_STATUSES } from '@ers/shared';
import { describe, expect, it } from 'vitest';

import { domainErrorCode } from '../../test/helpers/domain-error.js';

import {
  assertEventTransition,
  assertRegistrationTransition,
  canTransitionEvent,
  canTransitionRegistration,
} from './status-transitions.js';

const STARTED = {
  startsAt: new Date('2026-12-01T09:00:00Z'),
  now: new Date('2026-12-01T12:00:00Z'),
};
const UPCOMING = {
  startsAt: new Date('2026-12-01T09:00:00Z'),
  now: new Date('2026-11-30T12:00:00Z'),
};

describe('event transitions', () => {
  it.each([
    ['DRAFT', 'PUBLISHED', UPCOMING],
    ['DRAFT', 'CANCELLED', UPCOMING],
    ['PUBLISHED', 'COMPLETED', STARTED],
    ['PUBLISHED', 'CANCELLED', UPCOMING],
  ] as const)('allows %s -> %s', (from, to, timing) => {
    expect(
      domainErrorCode(() => {
        assertEventTransition(from, to, timing);
      }),
    ).toBeUndefined();
  });

  it.each([
    ['DRAFT', 'COMPLETED'],
    ['PUBLISHED', 'DRAFT'],
    ['COMPLETED', 'PUBLISHED'],
    ['CANCELLED', 'PUBLISHED'],
    ['CANCELLED', 'DRAFT'],
  ] as const)('forbids %s -> %s with INVALID_TRANSITION', (from, to) => {
    expect(
      domainErrorCode(() => {
        assertEventTransition(from, to, STARTED);
      }),
    ).toBe('INVALID_TRANSITION');
  });

  it('forbids completing an event before it starts', () => {
    expect(
      domainErrorCode(() => {
        assertEventTransition('PUBLISHED', 'COMPLETED', UPCOMING);
      }),
    ).toBe('INVALID_TRANSITION');
  });

  it('forbids publishing an event that has already started', () => {
    expect(
      domainErrorCode(() => {
        assertEventTransition('DRAFT', 'PUBLISHED', STARTED);
      }),
    ).toBe('INVALID_TRANSITION');
  });

  it('allows cancelling an event that is in progress', () => {
    const inProgress = { ...STARTED, endsAt: new Date('2026-12-02T09:00:00Z') };

    expect(
      domainErrorCode(() => {
        assertEventTransition('PUBLISHED', 'CANCELLED', inProgress);
      }),
    ).toBeUndefined();
  });

  it('forbids cancelling an event that has already ended', () => {
    const ended = { ...STARTED, endsAt: new Date('2026-12-01T10:00:00Z') };

    expect(
      domainErrorCode(() => {
        assertEventTransition('PUBLISHED', 'CANCELLED', ended);
      }),
    ).toBe('INVALID_TRANSITION');
  });

  it.each(EVENT_STATUSES)('forbids staying in %s (no-op transition)', (status) => {
    expect(canTransitionEvent(status, status)).toBe(false);
  });
});

describe('registration transitions', () => {
  it.each([
    ['CONFIRMED', 'CANCELLED'],
    ['CONFIRMED', 'ATTENDED'],
    ['WAITLISTED', 'CANCELLED'],
  ] as const)('allows a manual %s -> %s', (from, to) => {
    expect(
      domainErrorCode(() => {
        assertRegistrationTransition(from, to, { manual: true, timing: STARTED });
      }),
    ).toBeUndefined();
  });

  it('allows WAITLISTED -> CONFIRMED only as an automatic promotion', () => {
    expect(canTransitionRegistration('WAITLISTED', 'CONFIRMED', { manual: false })).toBe(true);
    expect(canTransitionRegistration('WAITLISTED', 'CONFIRMED', { manual: true })).toBe(false);
    expect(
      domainErrorCode(() => {
        assertRegistrationTransition('WAITLISTED', 'CONFIRMED', { manual: true, timing: STARTED });
      }),
    ).toBe('INVALID_TRANSITION');
  });

  it('forbids recording attendance before the session starts', () => {
    expect(
      domainErrorCode(() => {
        assertRegistrationTransition('CONFIRMED', 'ATTENDED', { manual: true, timing: UPCOMING });
      }),
    ).toBe('INVALID_TRANSITION');
  });

  it('allows cancelling before the session starts', () => {
    expect(
      domainErrorCode(() => {
        assertRegistrationTransition('CONFIRMED', 'CANCELLED', { manual: true, timing: UPCOMING });
      }),
    ).toBeUndefined();
  });

  it.each([
    ['WAITLISTED', 'ATTENDED'],
    ['CANCELLED', 'CONFIRMED'],
    ['ATTENDED', 'CANCELLED'],
    ['CANCELLED', 'WAITLISTED'],
  ] as const)('forbids %s -> %s even for the system', (from, to) => {
    expect(
      domainErrorCode(() => {
        assertRegistrationTransition(from, to, { manual: false, timing: STARTED });
      }),
    ).toBe('INVALID_TRANSITION');
  });

  it.each(REGISTRATION_STATUSES)('forbids staying in %s', (status) => {
    expect(canTransitionRegistration(status, status, { manual: false })).toBe(false);
  });
});
