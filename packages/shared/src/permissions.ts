import { ADMIN_ROLES, Role } from './roles.js';

/** Resource names match the admin's Refine resources and the API paths (/api/<resource>). */
export const Resource = {
  USERS: 'users',
  EVENTS: 'events',
  SESSIONS: 'sessions',
  REGISTRATIONS: 'registrations',
  TAGS: 'tags',
  CUSTOMERS: 'customers',
  APP_LOGS: 'app-logs',
  CATALOG: 'catalog',
  MY_REGISTRATIONS: 'my-registrations',
} as const;

export type Resource = (typeof Resource)[keyof typeof Resource];

/** Refine's standard actions plus the custom admin actions. */
export const Action = {
  LIST: 'list',
  SHOW: 'show',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  PUBLISH: 'publish',
  CANCEL: 'cancel',
  COMPLETE: 'complete',
  BULK_STATUS: 'bulk-status',
  CHANGE_ROLE: 'change-role',
} as const;

export type Action = (typeof Action)[keyof typeof Action];

const { ORGANIZER, CUSTOMER } = Role;
const STAFF = [...ADMIN_ROLES, ORGANIZER] as const;

/**
 * Who may do what. Single source of truth for both the API (enforced) and the admin (what is shown).
 * Row-level rules are applied on top in the API services: an organizer only ever sees their own
 * events and the sessions, registrations and customers that belong to them.
 */
export const PERMISSIONS: Readonly<Record<Resource, Partial<Record<Action, readonly Role[]>>>> = {
  [Resource.USERS]: {
    list: ADMIN_ROLES,
    show: ADMIN_ROLES,
    create: ADMIN_ROLES,
    edit: ADMIN_ROLES,
    delete: ADMIN_ROLES,
    'change-role': ADMIN_ROLES,
  },
  [Resource.EVENTS]: {
    list: STAFF,
    show: STAFF,
    create: STAFF,
    edit: STAFF,
    publish: STAFF,
    cancel: STAFF,
    complete: STAFF,
    delete: ADMIN_ROLES,
  },
  [Resource.SESSIONS]: { list: STAFF, show: STAFF, create: STAFF, edit: STAFF, delete: STAFF },
  [Resource.REGISTRATIONS]: {
    list: STAFF,
    show: STAFF,
    edit: STAFF,
    'bulk-status': STAFF,
    delete: ADMIN_ROLES,
  },
  [Resource.TAGS]: {
    list: STAFF,
    show: STAFF,
    create: ADMIN_ROLES,
    edit: ADMIN_ROLES,
    delete: ADMIN_ROLES,
  },
  [Resource.CUSTOMERS]: { list: STAFF, show: STAFF },
  [Resource.APP_LOGS]: { list: ADMIN_ROLES, show: ADMIN_ROLES },
  [Resource.CATALOG]: { list: [CUSTOMER], show: [CUSTOMER] },
  [Resource.MY_REGISTRATIONS]: {
    list: [CUSTOMER],
    show: [CUSTOMER],
    create: [CUSTOMER],
    cancel: [CUSTOMER],
  },
};

/** Resources that only customers use; admins manage the same data through the staff resources. */
export const CUSTOMER_ONLY_RESOURCES: readonly Resource[] = [
  Resource.CATALOG,
  Resource.MY_REGISTRATIONS,
];

const RESOURCES: ReadonlySet<string> = new Set(Object.values(Resource));
const ACTIONS: ReadonlySet<string> = new Set(Object.values(Action));

/** Narrows text from outside (a socket payload, a route) to a known resource name. */
export function isResource(value: unknown): value is Resource {
  return typeof value === 'string' && RESOURCES.has(value);
}

/** Narrows text from outside to a known action name. */
export function isAction(value: unknown): value is Action {
  return typeof value === 'string' && ACTIONS.has(value);
}

/**
 * True when the role may perform the action on the resource. Unknown pairs are denied, including
 * untyped strings from the admin router (own-property checks, never the prototype chain).
 */
export function can(role: Role, resource: Resource, action: Action): boolean {
  if (!Object.hasOwn(PERMISSIONS, resource)) {
    return false;
  }
  const actions = PERMISSIONS[resource];
  if (!Object.hasOwn(actions, action)) {
    return false;
  }
  const roles = actions[action];
  return Array.isArray(roles) && roles.includes(role);
}

/** Resources a role can open at all; drives the admin menu. */
export function visibleResources(role: Role): Resource[] {
  return Object.values(Resource).filter((resource) => can(role, resource, Action.LIST));
}
