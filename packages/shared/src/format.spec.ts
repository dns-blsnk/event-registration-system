import { describe, expect, it } from 'vitest';

import { formatPercent, seatsLeftLabel, toPercent } from './format.js';

describe('formatPercent', () => {
  it.each([
    [0, '0%'],
    [0.874, '87%'],
    [0.9, '90%'],
    [1, '100%'],
  ])('shows %p as %s', (share, text) => {
    expect(formatPercent(share)).toBe(text);
  });
});

describe('toPercent', () => {
  it('rounds to the whole percentage the label shows', () => {
    expect(toPercent(0.895)).toBe(90);
    expect(toPercent(0.894)).toBe(89);
  });
});

describe('seatsLeftLabel', () => {
  it('says Full at zero and counts the seats otherwise', () => {
    expect(seatsLeftLabel(0)).toBe('Full');
    expect(seatsLeftLabel(4)).toBe('4 left');
  });
});
