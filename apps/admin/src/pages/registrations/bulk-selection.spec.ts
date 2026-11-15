import { describe, expect, it } from 'vitest';

import { bulkSelection, hasBulkAction, offReason } from './bulk-selection';

import type { RegistrationListItem } from '@ers/shared';

const NOW = new Date('2026-11-15T12:00:00Z');

function row(id: string, overrides: Partial<RegistrationListItem> = {}): RegistrationListItem {
  return {
    id,
    status: 'CONFIRMED',
    createdAt: '2026-11-01T09:00:00Z',
    cancelledAt: null,
    customer: { id: `c-${id}`, name: id, email: `${id}@demo.test` },
    session: { id: 's1', title: 'Talk', startsAt: '2026-11-15T09:00:00Z' },
    event: { id: 'e1', title: 'Summit', status: 'PUBLISHED' },
    ...overrides,
  };
}

describe('bulkSelection', () => {
  it('keeps rows the API would refuse out of the request, with their reason', () => {
    const selection = bulkSelection([row('a'), row('b', { status: 'CANCELLED' })], 'ATTENDED', NOW);

    expect(selection.eligibleIds).toEqual(['a']);
    expect(selection.skippedIds).toEqual(['b']);
    expect([...selection.skipped]).toEqual([['already cancelled', 1]]);
  });

  it('skips attendance in an event that never ran', () => {
    const selection = bulkSelection(
      [row('a', { event: { id: 'e1', title: 'Summit', status: 'CANCELLED' } })],
      'ATTENDED',
      NOW,
    );

    expect(offReason(selection)).toBe('Not possible for the selection: 1 × the event did not run');
  });
});

describe('offReason', () => {
  it('is empty when the action applies to some rows', () => {
    expect(offReason(bulkSelection([row('a')], 'ATTENDED', NOW))).toBe('');
  });

  it('explains the per-request limit when too many rows apply', () => {
    const rows = Array.from({ length: 101 }, (_, index) => row(String(index)));

    expect(offReason(bulkSelection(rows, 'ATTENDED', NOW))).toBe('At most 100 at a time');
  });
});

describe('hasBulkAction', () => {
  it('is true while a seat can still be marked attended or cancelled', () => {
    expect(hasBulkAction(row('a'), NOW)).toBe(true);
    expect(
      hasBulkAction(
        row('b', { session: { id: 's1', title: 'Talk', startsAt: '2026-11-16T09:00:00Z' } }),
        NOW,
      ),
    ).toBe(true);
  });

  it('is false once nothing applies: a final status, or a cancelled event after its start', () => {
    expect(hasBulkAction(row('a', { status: 'CANCELLED' }), NOW)).toBe(false);
    expect(hasBulkAction(row('b', { status: 'ATTENDED' }), NOW)).toBe(false);
    expect(
      hasBulkAction(row('c', { event: { id: 'e1', title: 'Summit', status: 'CANCELLED' } }), NOW),
    ).toBe(false);
  });
});
