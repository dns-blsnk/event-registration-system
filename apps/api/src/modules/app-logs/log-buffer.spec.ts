import { describe, expect, it } from 'vitest';

import { LogBuffer } from './log-buffer.js';

describe('LogBuffer', () => {
  it('returns items oldest first', () => {
    const buffer = new LogBuffer<number>(5);
    [1, 2, 3].forEach((item) => {
      buffer.push(item);
    });

    expect(buffer.take(2)).toEqual([1, 2]);
    expect(buffer.size).toBe(1);
  });

  it('drops the oldest item when full and counts it', () => {
    const buffer = new LogBuffer<number>(2);
    [1, 2, 3].forEach((item) => {
      buffer.push(item);
    });

    expect(buffer.take(10)).toEqual([2, 3]);
    expect(buffer.takeDroppedCount()).toBe(1);
    expect(buffer.takeDroppedCount()).toBe(0);
  });

  it('restores a failed batch to the front', () => {
    const buffer = new LogBuffer<number>(5);
    [1, 2, 3].forEach((item) => {
      buffer.push(item);
    });
    const batch = buffer.take(2);
    buffer.push(4);

    buffer.restore(batch);

    expect(buffer.take(10)).toEqual([1, 2, 3, 4]);
  });

  it('keeps only what fits when restoring into a nearly full buffer', () => {
    const buffer = new LogBuffer<number>(3);
    [1, 2, 3].forEach((item) => {
      buffer.push(item);
    });
    const batch = buffer.take(3);
    [4, 5].forEach((item) => {
      buffer.push(item);
    });

    buffer.restore(batch);

    expect(buffer.take(10)).toEqual([3, 4, 5]);
    expect(buffer.takeDroppedCount()).toBe(2);
  });
});
