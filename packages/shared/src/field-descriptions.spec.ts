import { describe, expect, it } from 'vitest';

import { EVENT_STATUSES } from './domain.js';
import {
  EVENT_FIELDS,
  EVENT_LIST_CONTROLS,
  EVENT_STATUS_LABELS,
  SESSION_FIELDS,
} from './field-descriptions.js';

describe('field descriptions', () => {
  it('give every field a label and a help text', () => {
    for (const description of [
      ...Object.values(EVENT_FIELDS),
      ...Object.values(SESSION_FIELDS),
      ...Object.values(EVENT_LIST_CONTROLS),
    ]) {
      expect(description.label.length).toBeGreaterThan(0);
      expect(description.help.length).toBeGreaterThan(0);
    }
  });

  it('name every event status', () => {
    expect(Object.keys(EVENT_STATUS_LABELS).sort()).toEqual([...EVENT_STATUSES].sort());
  });
});
