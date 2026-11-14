import { Resource } from '@ers/shared';

import type { ResourceProps } from '@refinedev/core';

/**
 * Admin resources: names match the API paths and the shared permission matrix, so the menu,
 * the routes and the access checks all speak about the same thing.
 */
export const resources: ResourceProps[] = [
  {
    name: Resource.EVENTS,
    list: '/events',
    show: '/events/:id',
    create: '/events/create',
    edit: '/events/:id/edit',
    meta: { label: 'Events' },
  },
  {
    name: Resource.SESSIONS,
    list: '/sessions',
    show: '/sessions/:id',
    meta: { label: 'Sessions' },
  },
  { name: Resource.REGISTRATIONS, list: '/registrations', meta: { label: 'Registrations' } },
  { name: Resource.CUSTOMERS, list: '/customers', meta: { label: 'Customers' } },
  { name: Resource.TAGS, list: '/tags', meta: { label: 'Tags' } },
  { name: Resource.USERS, list: '/users', meta: { label: 'Users' } },
  { name: Resource.CATALOG, list: '/catalog', show: '/catalog/:id', meta: { label: 'Catalog' } },
  {
    name: Resource.MY_REGISTRATIONS,
    list: '/my-registrations',
    meta: { label: 'My registrations' },
  },
  { name: Resource.APP_LOGS, list: '/logs', show: '/logs/:id', meta: { label: 'Logs' } },
];
