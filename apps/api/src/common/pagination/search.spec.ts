import { describe, expect, it } from 'vitest';

import { containsInsensitive, escapeLikePattern } from './search.js';

describe('escapeLikePattern', () => {
  it.each([
    ['john_doe', 'john\\_doe'],
    ['100%', '100\\%'],
    ['back\\slash', 'back\\\\slash'],
    ['plain', 'plain'],
  ])('escapes %p', (input, expected) => {
    expect(escapeLikePattern(input)).toBe(expected);
  });
});

describe('containsInsensitive', () => {
  it('builds an escaped, case-insensitive filter', () => {
    expect(containsInsensitive('a_b')).toEqual({ contains: 'a\\_b', mode: 'insensitive' });
  });
});
