import { eventScope } from '../events/index.js';

import type { Prisma, User } from '../../generated/prisma/client.js';

/** Organizers only reach sessions of their own events; admins reach all. */
export function sessionScope(actor: Pick<User, 'id' | 'role'>): Prisma.SessionWhereInput {
  const scope = eventScope(actor);
  return Object.keys(scope).length === 0 ? {} : { event: scope };
}
