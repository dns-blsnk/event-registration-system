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
