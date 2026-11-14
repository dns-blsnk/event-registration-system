import { describe, expect, it } from 'vitest';

import { domainErrorCode } from '../../test/helpers/domain-error.js';

import {
  assertCanRegister,
  assertNoScheduleConflict,
  hasScheduleConflict,
} from './registration-rules.js';

import type { EventStatus } from '@ers/shared';

const NOW = new Date('2026-12-01T08:00:00Z');

function at(id: string, start: string, end: string): { id: string; startsAt: Date; endsAt: Date } {
  return {
    id,
    startsAt: new Date(`2026-12-01T${start}:00Z`),
    endsAt: new Date(`2026-12-01T${end}:00Z`),
  };
}

describe('assertCanRegister', () => {
  it('allows a future session of a published event', () => {
    expect(
      domainErrorCode(() => {
        assertCanRegister({ status: 'PUBLISHED' }, at('s', '09:00', '10:00'), NOW);
      }),
    ).toBeUndefined();
  });

  it.each(['DRAFT', 'COMPLETED', 'CANCELLED'] as EventStatus[])(
    'refuses an event that is %s',
    (status) => {
      expect(
        domainErrorCode(() => {
          assertCanRegister({ status }, at('s', '09:00', '10:00'), NOW);
        }),
      ).toBe('EVENT_NOT_OPEN');
    },
  );

  it('refuses a session that has already started', () => {
    expect(
      domainErrorCode(() => {
        assertCanRegister({ status: 'PUBLISHED' }, at('s', '08:00', '09:00'), NOW);
      }),
    ).toBe('SESSION_STARTED');
    expect(
      domainErrorCode(() => {
        assertCanRegister({ status: 'PUBLISHED' }, at('s', '07:00', '09:00'), NOW);
      }),
    ).toBe('SESSION_STARTED');
  });
});

describe('schedule conflicts', () => {
  it('allows a session that overlaps nothing confirmed', () => {
    expect(hasScheduleConflict(at('b', '11:00', '12:00'), [at('a', '09:00', '10:00')])).toBe(false);
  });

  it('allows back-to-back sessions', () => {
    expect(hasScheduleConflict(at('b', '10:00', '11:00'), [at('a', '09:00', '10:00')])).toBe(false);
  });

  it('ignores the candidate session itself', () => {
    expect(hasScheduleConflict(at('a', '09:00', '10:00'), [at('a', '09:00', '10:00')])).toBe(false);
  });

  it('refuses a session overlapping another confirmed one', () => {
    expect(
      domainErrorCode(() => {
        assertNoScheduleConflict(at('b', '09:30', '10:30'), [at('a', '09:00', '10:00')]);
      }),
    ).toBe('SCHEDULE_CONFLICT');
  });
});
