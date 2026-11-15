import { describe, expect, it } from 'vitest';

import { isInCatalog } from './catalog.js';

const NOW = new Date('2026-11-15T12:00:00Z');

describe('isInCatalog', () => {
  it('shows a published event until it ends', () => {
    expect(isInCatalog({ status: 'PUBLISHED', endsAt: '2026-11-16T12:00:00Z' }, NOW)).toBe(true);
    expect(isInCatalog({ status: 'PUBLISHED', endsAt: '2026-11-15T12:00:00Z' }, NOW)).toBe(false);
  });

  it('never shows a draft, cancelled or completed event', () => {
    for (const status of ['DRAFT', 'CANCELLED', 'COMPLETED'] as const) {
      expect(isInCatalog({ status, endsAt: '2099-01-01T00:00:00Z' }, NOW)).toBe(false);
    }
  });
});
