import { describe, expect, it } from 'vitest';

import {
  Action,
  can,
  CUSTOMER_ONLY_RESOURCES,
  PERMISSIONS,
  Resource,
  visibleResources,
} from './permissions.js';
import { ROLES, type Role } from './roles.js';

const STAFF_RESOURCES = Object.values(Resource).filter(
  (resource) => !CUSTOMER_ONLY_RESOURCES.includes(resource),
);

describe('can', () => {
  it.each(STAFF_RESOURCES)('lets an admin do every defined action on %s', (resource) => {
    for (const action of Object.keys(PERMISSIONS[resource]) as Action[]) {
      expect(can('ADMIN', resource, action), `${resource}:${action}`).toBe(true);
    }
  });

  it.each([
    [Resource.USERS, Action.LIST],
    [Resource.USERS, Action.CHANGE_ROLE],
    [Resource.APP_LOGS, Action.LIST],
    [Resource.EVENTS, Action.DELETE],
    [Resource.TAGS, Action.CREATE],
    [Resource.REGISTRATIONS, Action.DELETE],
  ])('keeps %s:%s away from organizers', (resource, action) => {
    expect(can('ORGANIZER', resource, action)).toBe(false);
  });

  it.each([
    [Resource.EVENTS, Action.CREATE],
    [Resource.EVENTS, Action.PUBLISH],
    [Resource.EVENTS, Action.COMPLETE],
    [Resource.SESSIONS, Action.EDIT],
    [Resource.REGISTRATIONS, Action.BULK_STATUS],
    [Resource.CUSTOMERS, Action.LIST],
    [Resource.TAGS, Action.LIST],
  ])('lets organizers %s:%s', (resource, action) => {
    expect(can('ORGANIZER', resource, action)).toBe(true);
  });

  it('lets customers cancel their own registrations', () => {
    expect(can('CUSTOMER', Resource.MY_REGISTRATIONS, Action.CANCEL)).toBe(true);
  });

  it('keeps customers out of staff resources', () => {
    for (const resource of STAFF_RESOURCES) {
      expect(can('CUSTOMER', resource, Action.LIST), resource).toBe(false);
    }
  });

  it.each(ROLES)('denies actions that are not defined for a resource (%s)', (role: Role) => {
    expect(can(role, Resource.APP_LOGS, Action.DELETE)).toBe(false);
    expect(can(role, Resource.CUSTOMERS, Action.EDIT)).toBe(false);
  });

  it('denies unknown resources and actions instead of throwing', () => {
    expect(can('ADMIN', 'dashboard' as Resource, Action.LIST)).toBe(false);
    expect(can('ADMIN', Resource.USERS, 'toString' as Action)).toBe(false);
    expect(can('ADMIN', 'constructor' as Resource, Action.LIST)).toBe(false);
  });
});

describe('visibleResources', () => {
  it('confines customers to the catalog and their own registrations', () => {
    expect(visibleResources('CUSTOMER')).toEqual(CUSTOMER_ONLY_RESOURCES);
  });

  it('shows admins every staff resource', () => {
    expect(visibleResources('ADMIN')).toEqual(STAFF_RESOURCES);
  });

  it('hides users and logs from organizers', () => {
    expect(visibleResources('ORGANIZER')).toEqual([
      'events',
      'sessions',
      'registrations',
      'tags',
      'customers',
    ]);
  });
});
