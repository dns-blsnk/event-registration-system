import { describe, expect, it } from 'vitest';

import {
  toSessionCreatePayload,
  toSessionFormValues,
  toSessionPatch,
  type SessionFormValues,
} from './session-form-values';

import type { SessionListItem } from '@ers/shared';

const session = {
  id: 's1',
  eventId: 'e1',
  title: 'State of React',
  speaker: 'Ann',
  room: null,
  startsAt: '2026-12-01T09:00:30.000Z',
  endsAt: '2026-12-01T10:00:00.000Z',
  capacity: 50,
} as SessionListItem;

const filled: SessionFormValues = {
  title: 'Workshop',
  speaker: '  ',
  room: ' Room B ',
  startsAt: '2026-12-01T12:00',
  endsAt: '2026-12-01T13:00',
  capacity: '30',
};

describe('session form values', () => {
  it('builds a create payload with ISO dates, a number capacity and no empty optional fields', () => {
    expect(toSessionCreatePayload(filled, 'e1')).toEqual({
      eventId: 'e1',
      title: 'Workshop',
      room: 'Room B',
      startsAt: new Date('2026-12-01T12:00').toISOString(),
      endsAt: new Date('2026-12-01T13:00').toISOString(),
      capacity: 30,
    });
  });

  it('shows a missing room as an empty box', () => {
    expect(toSessionFormValues(session)).toMatchObject({
      speaker: 'Ann',
      room: '',
      capacity: '50',
    });
  });

  it('patches only changed fields and clears an emptied speaker with null', () => {
    const original = toSessionFormValues(session);

    expect(toSessionPatch(original, original)).toEqual({});
    expect(toSessionPatch({ ...original, capacity: '60' }, original)).toEqual({ capacity: 60 });
    expect(toSessionPatch({ ...original, speaker: '' }, original)).toEqual({ speaker: null });
  });
});
