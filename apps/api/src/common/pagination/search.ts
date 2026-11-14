/** Escapes LIKE wildcards so a search for "john_doe" matches only that literal text. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Prisma filter for a case-insensitive "contains" search on user input. */
export function containsInsensitive(search: string): { contains: string; mode: 'insensitive' } {
  return { contains: escapeLikePattern(search), mode: 'insensitive' };
}

/** Search a person by name or email; undefined search matches everyone. */
export function personSearch(search: string | undefined): {
  OR?: [
    { name: ReturnType<typeof containsInsensitive> },
    { email: ReturnType<typeof containsInsensitive> },
  ];
} {
  return search === undefined
    ? {}
    : { OR: [{ name: containsInsensitive(search) }, { email: containsInsensitive(search) }] };
}
