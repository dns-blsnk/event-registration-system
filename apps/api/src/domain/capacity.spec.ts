import { describe, expect, it } from 'vitest';

import { fillRate, isAlmostFull, seatsLeft } from './capacity.js';

describe('capacity', () => {
  it.each([
    [{ capacity: 50, confirmedCount: 0 }, 50, 0],
    [{ capacity: 50, confirmedCount: 20 }, 30, 0.4],
    [{ capacity: 50, confirmedCount: 50 }, 0, 1],
  ])('%j has %i seats left and fill rate %f', (seats, left, rate) => {
    expect(seatsLeft(seats)).toBe(left);
    expect(fillRate(seats)).toBe(rate);
  });

  it('never reports negative seats or a rate above 1', () => {
    expect(seatsLeft({ capacity: 10, confirmedCount: 12 })).toBe(0);
    expect(fillRate({ capacity: 10, confirmedCount: 12 })).toBe(1);
  });

  it('treats no seats at all as empty, not full', () => {
    expect(fillRate({ capacity: 0, confirmedCount: 0 })).toBe(0);
    expect(isAlmostFull({ capacity: 0, confirmedCount: 0 })).toBe(false);
  });

  it('flags a session as almost full from 90% of seats taken', () => {
    expect(isAlmostFull({ capacity: 10, confirmedCount: 8 })).toBe(false);
    expect(isAlmostFull({ capacity: 10, confirmedCount: 9 })).toBe(true);
    expect(isAlmostFull({ capacity: 10, confirmedCount: 10 })).toBe(true);
  });
});
