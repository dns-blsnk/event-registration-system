import { Action, can, Resource } from '@ers/shared';

import { loadUser } from './auth-provider';

import type { AccessControlProvider } from '@refinedev/core';

const RESOURCES: ReadonlySet<string> = new Set(Object.values(Resource));
const ACTIONS: ReadonlySet<string> = new Set(Object.values(Action));

function isResource(value: string | undefined): value is Resource {
  return value !== undefined && RESOURCES.has(value);
}

function isAction(value: string): value is Action {
  return ACTIONS.has(value);
}

/**
 * Hides menu items and buttons with the same permission matrix the API enforces. It is only a
 * convenience: the server still decides, so a hidden button never protects anything by itself.
 */
export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    const role = (await loadUser())?.role;
    return {
      can:
        role !== undefined &&
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
