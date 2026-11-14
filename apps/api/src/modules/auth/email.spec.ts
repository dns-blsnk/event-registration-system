import { describe, expect, it } from 'vitest';

import { normalizeEmail } from './email.js';

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Anna.Smith@Example.COM ')).toBe('anna.smith@example.com');
  });
});
