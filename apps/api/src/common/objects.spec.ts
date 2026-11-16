import { describe, expect, it } from 'vitest';

import { omitUndefined } from './objects.js';

describe('omitUndefined', () => {
  it('drops undefined values and keeps everything else, including null and falsy values', () => {
    expect(omitUndefined({ a: 1, b: undefined, c: null, d: '', e: 0, f: false })).toEqual({
      a: 1,
      c: null,
      d: '',
      e: 0,
      f: false,
    });
  });
});
