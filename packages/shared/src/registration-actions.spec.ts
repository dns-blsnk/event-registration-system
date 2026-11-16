import { describe, expect, it } from 'vitest';

import { staffActionRefusal } from './registration-actions.js';

import type { RegistrationStatus } from './domain.js';

const NOW = new Date('2026-11-15T12:00:00Z');
const PAST = new Date('2026-11-15T09:00:00Z');
const FUTURE = new Date('2026-11-20T09:00:00Z');

function refusal(
  status: RegistrationStatus,
  sessionStartsAt: Date,
  target: typeof RegistrationStatus.ATTENDED | typeof RegistrationStatus.CANCELLED,
): string | undefined {
  return staffActionRefusal({ status, sessionStartsAt, eventStatus: 'PUBLISHED' }, target, NOW);
}

describe('staffActionRefusal', () => {
  it('lets staff mark a confirmed seat attended once the session has started', () => {
    expect(refusal('CONFIRMED', PAST, 'ATTENDED')).toBeUndefined();
  });

  it.each(['DRAFT', 'CANCELLED'] as const)(
    'refuses attendance in a %s event, which never ran',
    (eventStatus) => {
      expect(
        staffActionRefusal(
          { status: 'CONFIRMED', sessionStartsAt: PAST, eventStatus },
          'ATTENDED',
          NOW,
        ),
      ).toBe('the event did not run');
    },
  );

  it('allows attendance in a completed event', () => {
    expect(
      staffActionRefusal(
        { status: 'CONFIRMED', sessionStartsAt: PAST, eventStatus: 'COMPLETED' },
        'ATTENDED',
        NOW,
      ),
    ).toBeUndefined();
  });

  it('refuses attendance before the session starts', () => {
    expect(refusal('CONFIRMED', FUTURE, 'ATTENDED')).toBe('the session has not started yet');
  });

  it.each([
    ['CANCELLED', 'already cancelled'],
    ['ATTENDED', 'already attended'],
    ['WAITLISTED', 'waitlisted, so there is no seat to attend'],
  ] as const)('refuses attendance for a %s registration', (status, reason) => {
    expect(refusal(status, PAST, 'ATTENDED')).toBe(reason);
  });

  it('lets staff cancel a seat or a waitlist place before the session starts', () => {
    expect(refusal('CONFIRMED', FUTURE, 'CANCELLED')).toBeUndefined();
    expect(refusal('WAITLISTED', FUTURE, 'CANCELLED')).toBeUndefined();
  });

  it('refuses to cancel a seat once the session has started', () => {
    expect(refusal('CONFIRMED', PAST, 'CANCELLED')).toBe('the session has already started');
  });

  it('still lets staff clear a leftover waitlist place after the start', () => {
    expect(refusal('WAITLISTED', PAST, 'CANCELLED')).toBeUndefined();
  });

  it.each([
    ['CANCELLED', 'already cancelled'],
    ['ATTENDED', 'already attended'],
  ] as const)('refuses to cancel a %s registration', (status, reason) => {
    expect(refusal(status, FUTURE, 'CANCELLED')).toBe(reason);
  });
});
