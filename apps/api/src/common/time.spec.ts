import { describe, expect, it } from 'vitest';

import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from './time.js';

describe('time units', () => {
  it('are consistent with each other', () => {
    expect(MINUTE_MS).toBe(60 * SECOND_MS);
    expect(HOUR_MS).toBe(60 * MINUTE_MS);
    expect(DAY_MS).toBe(24 * HOUR_MS);
  });
});
