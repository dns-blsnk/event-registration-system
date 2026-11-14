import { describe, expect, it } from 'vitest';

import { EVENT_STATUSES } from './domain.js';
import { EVENT_FIELDS, EVENT_STATUS_LABELS } from './field-descriptions.js';

describe('field descriptions', () => {
  it('give every event field a label and a help text', () => {
    for (const description of Object.values(EVENT_FIELDS)) {
      expect(description.label.length).toBeGreaterThan(0);
      expect(description.help.length).toBeGreaterThan(0);
    }
  });

  it('name every event status', () => {
    expect(Object.keys(EVENT_STATUS_LABELS).sort()).toEqual([...EVENT_STATUSES].sort());
  });
});
