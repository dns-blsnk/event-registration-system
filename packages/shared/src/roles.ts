/** User roles. Values match the Prisma `Role` enum. */
export const Role = {
  ADMIN: 'ADMIN',
  ORGANIZER: 'ORGANIZER',
  CUSTOMER: 'CUSTOMER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ROLES: readonly Role[] = Object.values(Role);

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Roles that can own (organize) an event: what the events list's owner filter offers. */
export const EVENT_OWNER_ROLES: readonly Role[] = [Role.ADMIN, Role.ORGANIZER];

/** The users list filter that keeps only possible event owners. */
export const EVENT_OWNERS_FILTER = { field: 'canOrganize', value: 'true' } as const;
