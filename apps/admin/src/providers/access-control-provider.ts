import { can, isAction, isResource } from '@ers/shared';

import { loadUser } from './auth-provider';

import type { AccessControlProvider } from '@refinedev/core';

/**
 * Deny by default: anything that is not a known resource and action of the matrix is refused.
 * Hides menu items and buttons with the same permission matrix the API enforces. It is only a
 * convenience: the server still decides, so a hidden button never protects anything by itself.
 */
export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    const role = (await loadUser())?.role;
    return {
      can:
        role !== undefined &&
        resource !== undefined &&
        isResource(resource) &&
        isAction(action) &&
        can(role, resource, action),
    };
  },
  options: {
    buttons: { enableAccessControl: true, hideIfUnauthorized: true },
    // Answers depend on who is signed in; never reuse one from a previous user or a page unmounted at logout.
    queryOptions: { staleTime: 0, gcTime: 0 },
  },
};
