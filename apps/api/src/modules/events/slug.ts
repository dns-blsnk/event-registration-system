import { randomBytes } from 'node:crypto';

const SLUG_BASE_MAX_LENGTH = 200;
const SUFFIX_BYTES = 3;

/** URL-safe slug from a title plus a short random suffix, so equal titles never collide. */
export function makeSlug(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_BASE_MAX_LENGTH)
    .replace(/^-+|-+$/g, '');
  const suffix = randomBytes(SUFFIX_BYTES).toString('hex');
  return base === '' ? `event-${suffix}` : `${base}-${suffix}`;
}
