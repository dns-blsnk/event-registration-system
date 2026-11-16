import { describe, expect, it } from 'vitest';

import { ErrorCode } from './errors.js';

describe('ErrorCode', () => {
  it('uses each code name as its value', () => {
    for (const [name, value] of Object.entries(ErrorCode)) {
      expect(value).toBe(name);
    }
  });
});
