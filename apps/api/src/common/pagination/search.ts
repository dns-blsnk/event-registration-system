/** Escapes LIKE wildcards so a search for "john_doe" matches only that literal text. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Prisma filter for a case-insensitive "contains" search on user input. */
export function containsInsensitive(search: string): { contains: string; mode: 'insensitive' } {
  return { contains: escapeLikePattern(search), mode: 'insensitive' };
}
