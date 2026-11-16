import { hasAdminPowers, Role, ROLES } from './roles.js';

/** The roles an actor may give a user, creating it or changing its role. */
export function assignableRoles(actorRole: Role): readonly Role[] {
  if (actorRole === Role.SUPER_ADMIN) return ROLES;
  return hasAdminPowers(actorRole) ? ROLES.filter((role) => !hasAdminPowers(role)) : [];
}

/** Why the actor may not give a user this role (creating it or changing it), or undefined. */
export function roleGrantRefusal(actorRole: Role, newRole: Role): string | undefined {
  return assignableRoles(actorRole).includes(newRole)
    ? undefined
    : 'Only a super admin can grant an admin role';
}

/**
 * Why the actor may not edit or delete this user, or undefined when they may. Admins manage
 * organizers and customers; admins and super admins are managed by super admins only, so one admin
 * can never demote or delete another. The API enforces this; the admin uses it to hide buttons.
 */
export function userManagementRefusal(actorRole: Role, targetRole: Role): string | undefined {
  if (!hasAdminPowers(actorRole)) return 'Only admins manage users';
  if (hasAdminPowers(targetRole) && actorRole !== Role.SUPER_ADMIN) {
    return 'Only a super admin can change or delete an admin';
  }
  return undefined;
}

/** Why the actor may not give this user the new role, or undefined when they may. */
export function roleChangeRefusal(
  actorRole: Role,
  targetRole: Role,
  newRole: Role,
): string | undefined {
  return userManagementRefusal(actorRole, targetRole) ?? roleGrantRefusal(actorRole, newRole);
}
