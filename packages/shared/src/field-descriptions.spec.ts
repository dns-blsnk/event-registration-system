import { describe, expect, it } from 'vitest';

import { ALMOST_FULL_RATIO, EVENT_STATUSES, REGISTRATION_STATUSES } from './domain.js';
import {
  EVENT_FIELDS,
  EVENT_LIST_CONTROLS,
  EVENT_STATUS_LABELS,
  REGISTRATION_FIELDS,
  REGISTRATION_LIST_CONTROLS,
  REGISTRATION_STATUS_LABELS,
  SESSION_FIELDS,
  SESSION_LIST_CONTROLS,
} from './field-descriptions.js';
import { formatPercent } from './format.js';

describe('field descriptions', () => {
  it('give every field a label and a help text', () => {
    for (const description of [
      ...Object.values(EVENT_FIELDS),
      ...Object.values(SESSION_FIELDS),
      ...Object.values(EVENT_LIST_CONTROLS),
      ...Object.values(SESSION_LIST_CONTROLS),
      ...Object.values(REGISTRATION_FIELDS),
      ...Object.values(REGISTRATION_LIST_CONTROLS),
    ]) {
      expect(description.label.length).toBeGreaterThan(0);
      expect(description.help.length).toBeGreaterThan(0);
    }
  });

  it('describe the almost-full filter with the shared ratio', () => {
    expect(SESSION_LIST_CONTROLS.almostFull.help).toContain(formatPercent(ALMOST_FULL_RATIO));
  });

  it('name every event status', () => {
    expect(Object.keys(EVENT_STATUS_LABELS).sort()).toEqual([...EVENT_STATUSES].sort());
  });

  it('name every registration status', () => {
    expect(Object.keys(REGISTRATION_STATUS_LABELS).sort()).toEqual(
      [...REGISTRATION_STATUSES].sort(),
    );
  });
});
