import { describe, expect, it } from 'vitest';

import { TRANSACTION_MAX_WAIT_MS, TRANSACTION_TIMEOUT_MS } from './prisma.service.js';

describe('transaction limits', () => {
  it('give a queue of bookings on one session more room than the Prisma defaults (2 s and 5 s)', () => {
    expect(TRANSACTION_MAX_WAIT_MS).toBeGreaterThan(2000);
    expect(TRANSACTION_TIMEOUT_MS).toBeGreaterThan(5000);
  });
});
