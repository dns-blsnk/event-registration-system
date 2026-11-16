import { describe, expect, it } from 'vitest';

import { containsInsensitive, escapeLikePattern, personSearch } from './search.js';

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

describe('personSearch', () => {
  it('matches name or email, escaping wildcards', () => {
    expect(personSearch('a_b')).toEqual({
      OR: [
        { name: { contains: 'a\\_b', mode: 'insensitive' } },
        { email: { contains: 'a\\_b', mode: 'insensitive' } },
      ],
    });
  });

  it('matches everyone without a search', () => {
    expect(personSearch(undefined)).toEqual({});
  });
});
