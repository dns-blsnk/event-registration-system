import { Resource } from '@ers/shared';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import EventIcon from '@mui/icons-material/Event';
import GroupsIcon from '@mui/icons-material/Groups';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import LabelIcon from '@mui/icons-material/Label';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ScheduleIcon from '@mui/icons-material/Schedule';
import StorefrontIcon from '@mui/icons-material/Storefront';

import type { ResourceProps } from '@refinedev/core';

/**
 * Admin resources: names match the API paths and the shared permission matrix, so the menu,
 * the routes and the access checks all speak about the same thing. The icon tells the sections
 * apart in the menu, also when it is collapsed to icons only.
 */
export const resources: ResourceProps[] = [
  {
    name: Resource.EVENTS,
    list: '/events',
    show: '/events/:id',
    create: '/events/create',
    edit: '/events/:id/edit',
    meta: { label: 'Events', icon: <EventIcon /> },
  },
  {
    name: Resource.SESSIONS,
    list: '/sessions',
    show: '/sessions/:id',
    meta: { label: 'Sessions', icon: <ScheduleIcon /> },
  },
  {
    name: Resource.REGISTRATIONS,
    list: '/registrations',
    meta: { label: 'Registrations', icon: <HowToRegIcon /> },
  },
  {
    name: Resource.CUSTOMERS,
    list: '/customers',
    meta: { label: 'Customers', icon: <GroupsIcon /> },
  },
  { name: Resource.TAGS, list: '/tags', meta: { label: 'Tags', icon: <LabelIcon /> } },
  { name: Resource.USERS, list: '/users', meta: { label: 'Users', icon: <ManageAccountsIcon /> } },
  {
    name: Resource.CATALOG,
    list: '/catalog',
    show: '/catalog/:id',
    meta: { label: 'Catalog', icon: <StorefrontIcon /> },
  },
  {
    name: Resource.MY_REGISTRATIONS,
    list: '/my-registrations',
    meta: { label: 'My registrations', icon: <ConfirmationNumberIcon /> },
  },
  {
    name: Resource.APP_LOGS,
    list: '/logs',
    show: '/logs/:id',
    meta: { label: 'Logs', icon: <ReceiptLongIcon /> },
  },
];
