import { describe, expect, it } from 'vitest';

import { RateWindow } from './rate-window.js';

describe('RateWindow', () => {
  it('accepts up to the limit within a window and counts the rest', () => {
    let now = 0;
    const window = new RateWindow(2, 1000, () => now);

    expect([window.tryAccept(), window.tryAccept(), window.tryAccept()]).toEqual([
      true,
      true,
      false,
    ]);
    expect(window.takeRejectedCount()).toBe(1);
    expect(window.takeRejectedCount()).toBe(0);

    now = 500;
    expect(window.tryAccept()).toBe(false);
  });

  it('starts accepting again in the next window', () => {
    let now = 0;
    const window = new RateWindow(1, 1000, () => now);
    window.tryAccept();

    now = 1000;

    expect(window.tryAccept()).toBe(true);
  });
});
