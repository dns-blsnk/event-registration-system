import { describe, expect, it } from 'vitest';

import { makeSlug } from './slug.js';

describe('makeSlug', () => {
  it('turns a title into a lowercase, hyphenated slug with a random suffix', () => {
    expect(makeSlug('Frontend Summit 2027!')).toMatch(/^frontend-summit-2027-[0-9a-f]{6}$/);
  });

  it('removes accents', () => {
    expect(makeSlug('Café Déjà Vu')).toMatch(/^cafe-deja-vu-[0-9a-f]{6}$/);
  });

  it('falls back to "event" for titles with no latin letters or digits', () => {
    expect(makeSlug('Конференція')).toMatch(/^event-[0-9a-f]{6}$/);
  });

  it('never leaves a double hyphen when a long title is cut at a word boundary', () => {
    const title = `${'a'.repeat(199)} b`;

    expect(makeSlug(title)).not.toContain('--');
  });

  it('never repeats for the same title', () => {
    expect(makeSlug('Same')).not.toBe(makeSlug('Same'));
  });
});
