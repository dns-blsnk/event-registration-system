import { describe, expect, it } from 'vitest';

import { AppLogCategory, AppLogLevel } from './app-logs.js';
import { PASSWORD_MIN_LENGTH } from './auth.js';
import { ALMOST_FULL_RATIO, EVENT_STATUSES, REGISTRATION_STATUSES } from './domain.js';
import {
  APP_LOG_CATEGORY_LABELS,
  APP_LOG_FIELDS,
  APP_LOG_LEVEL_LABELS,
  APP_LOG_LIST_CONTROLS,
  CUSTOMER_FIELDS,
  CUSTOMER_LIST_CONTROLS,
  TAG_FIELDS,
  TAG_LIST_CONTROLS,
  EVENT_FIELDS,
  EVENT_LIST_CONTROLS,
  EVENT_STATUS_LABELS,
  REGISTRATION_FIELDS,
  REGISTRATION_LIST_CONTROLS,
  REGISTRATION_STATUS_LABELS,
  SESSION_FIELDS,
  SIGNUP_FIELDS,
  ROLE_LABELS,
  SESSION_LIST_CONTROLS,
  USER_FIELDS,
  USER_LIST_CONTROLS,
} from './field-descriptions.js';
import { formatPercent } from './format.js';
import { ROLES } from './roles.js';

describe('field descriptions', () => {
  it('give every field a label and a help text', () => {
    for (const description of [
      ...Object.values(EVENT_FIELDS),
      ...Object.values(SESSION_FIELDS),
      ...Object.values(EVENT_LIST_CONTROLS),
      ...Object.values(SESSION_LIST_CONTROLS),
      ...Object.values(REGISTRATION_FIELDS),
      ...Object.values(REGISTRATION_LIST_CONTROLS),
      ...Object.values(USER_FIELDS),
      ...Object.values(USER_LIST_CONTROLS),
      ...Object.values(APP_LOG_FIELDS),
      ...Object.values(APP_LOG_LIST_CONTROLS),
      ...Object.values(TAG_FIELDS),
      ...Object.values(CUSTOMER_FIELDS),
      ...Object.values(TAG_LIST_CONTROLS),
      ...Object.values(CUSTOMER_LIST_CONTROLS),
      ...Object.values(SIGNUP_FIELDS),
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

  it('name every role', () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...ROLES].sort());
  });

  it('state the password minimum from the shared limit', () => {
    expect(USER_FIELDS.password.help).toContain(String(PASSWORD_MIN_LENGTH));
  });

  it('name every log level and category', () => {
    expect(Object.keys(APP_LOG_LEVEL_LABELS).sort()).toEqual(Object.values(AppLogLevel).sort());
    expect(Object.keys(APP_LOG_CATEGORY_LABELS).sort()).toEqual(
      Object.values(AppLogCategory).sort(),
    );
  });
});
