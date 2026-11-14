import { Resource } from '@ers/shared';

import type { ResourceProps } from '@refinedev/core';

/**
 * Admin resources: names match the API paths and the shared permission matrix, so the menu,
 * the routes and the access checks all speak about the same thing.
 */
export const resources: ResourceProps[] = [
  { name: Resource.EVENTS, list: '/events', meta: { label: 'Events' } },
];
