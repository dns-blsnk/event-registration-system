import { describe, expect, it } from 'vitest';

import { clip } from './text.js';

describe('clip', () => {
  it('keeps text that fits', () => {
    expect(clip('short', 10)).toBe('short');
  });

  it('cuts text to the limit and marks the cut', () => {
    expect(clip('abcdefghij-overflow', 10)).toBe('abcdefghi…');
  });
});
