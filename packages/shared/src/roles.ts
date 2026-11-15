/** User roles. Values match the Prisma `Role` enum. */
export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  ORGANIZER: 'ORGANIZER',
  CUSTOMER: 'CUSTOMER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ROLES: readonly Role[] = Object.values(Role);

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * Roles with an admin's powers over the system. A super admin is an admin who, on top, is the only
 * one allowed to grant, take away or delete admin roles.
 */
export const ADMIN_ROLES: readonly Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

/** Whether the role has an admin's powers: every event and user, not only one's own. */
export function hasAdminPowers(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

/** Roles that can own (organize) an event: what the events list's owner filter offers. */
export const EVENT_OWNER_ROLES: readonly Role[] = [...ADMIN_ROLES, Role.ORGANIZER];

/** The users list filter that keeps only possible event owners. */
export const EVENT_OWNERS_FILTER = { field: 'canOrganize', value: 'true' } as const;
