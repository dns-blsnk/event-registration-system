import { containsInsensitive } from '../../common/pagination/search.js';

import type { Prisma } from '../../generated/prisma/client.js';

/**
 * The text filters every list of events shares (the staff list and the customers' catalog), so
 * both always search the same way: the city box matches part of the city name ("war" finds
 * Warsaw), and the search box matches the title or venue, not the city, which has its own box.
 */
export function eventTextFilters(
  city: string | undefined,
  search: string | undefined,
): Prisma.EventWhereInput[] {
  return [
    city === undefined ? {} : { city: containsInsensitive(city) },
    search === undefined
      ? {}
      : { OR: [{ title: containsInsensitive(search) }, { venue: containsInsensitive(search) }] },
  ];
}
