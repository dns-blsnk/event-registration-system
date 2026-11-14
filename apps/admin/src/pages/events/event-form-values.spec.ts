import { describe, expect, it } from 'vitest';

import {
  fromInputDateTime,
  toEventFormValues,
  toEventPatch,
  toEventPayload,
  toInputDateTime,
} from './event-form-values';

import type { EventDetail } from '@ers/shared';

describe('event form values', () => {
  it('round-trips a date through the datetime-local input', () => {
    const iso = '2026-12-01T09:30:00.000Z';

    expect(fromInputDateTime(toInputDateTime(iso))).toBe(iso);
  });

  it('turns an event into form values and back into the API payload', () => {
    const event = {
      title: 'Summit',
      description: 'Talks',
      city: 'Kyiv',
      venue: 'Hall',
      startsAt: '2026-12-01T09:00:00.000Z',
      endsAt: '2026-12-02T18:00:00.000Z',
      tags: [{ id: 't1', name: 'AI' }],
    } as EventDetail;

    expect(toEventPayload(toEventFormValues(event))).toEqual({
      title: 'Summit',
      description: 'Talks',
      city: 'Kyiv',
      venue: 'Hall',
      startsAt: '2026-12-01T09:00:00.000Z',
      endsAt: '2026-12-02T18:00:00.000Z',
      tagIds: ['t1'],
    });
  });

  it('patches only the fields that differ from the loaded event', () => {
    const original = toEventFormValues({
      title: 'Summit',
      description: 'Talks',
      city: 'Kyiv',
      venue: 'Hall',
      startsAt: '2026-12-01T09:00:30.000Z',
      endsAt: '2026-12-02T18:00:00.000Z',
      tags: [{ id: 't1', name: 'AI' }],
    } as EventDetail);

    expect(toEventPatch({ ...original, title: 'Renamed' }, original)).toEqual({ title: 'Renamed' });
    expect(toEventPatch({ ...original, tags: [] }, original)).toEqual({ tagIds: [] });
    expect(toEventPatch(original, original)).toEqual({});
  });
});
