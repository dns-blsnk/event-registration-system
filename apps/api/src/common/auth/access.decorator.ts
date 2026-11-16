import type { Action, Resource } from '@ers/shared';

export const ACCESS_KEY = 'access';

/** Exactly one access rule per route (or per controller, which a method rule overrides). */
export type AccessRule =
  | { kind: 'public' }
  | { kind: 'signed-in' }
  | { kind: 'permission'; resource: Resource; action: Action };

/**
 * Sets the access rule on a method or class. Declaring two rules on the same target throws at
 * startup, so a route can never silently end up with the weaker of two rules.
 */
function access(rule: AccessRule): ClassDecorator & MethodDecorator {
  return (target: object, _key?: string | symbol, descriptor?: PropertyDescriptor) => {
    const holder: object = (descriptor?.value as object | undefined) ?? target;
    if (Reflect.hasOwnMetadata(ACCESS_KEY, holder)) {
      throw new Error(
        `Conflicting access rules on ${String(_key ?? (target as { name?: string }).name)}`,
      );
    }
    Reflect.defineMetadata(ACCESS_KEY, rule, holder);
  };
}

/** Reachable without a session. */
export const Public = (): ClassDecorator & MethodDecorator => access({ kind: 'public' });

/** Any signed-in user, whatever the role (e.g. /auth/me). */
export const SignedIn = (): ClassDecorator & MethodDecorator => access({ kind: 'signed-in' });

/** Only roles that the shared permission matrix grants this action. */
export const RequirePermission = (
  resource: Resource,
  action: Action,
): ClassDecorator & MethodDecorator => access({ kind: 'permission', resource, action });
