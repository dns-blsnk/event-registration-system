import { Role } from '@ers/shared';

import type { Prisma, User } from '../../generated/prisma/client.js';

/**
 * Row-level access: admins see every event, organizers only their own. Applied inside every query,
 * so an organizer can never load, list or change another organizer's event (it looks like a 404).
 */
export function eventScope(actor: Pick<User, 'id' | 'role'>): Prisma.EventWhereInput {
  return actor.role === Role.ADMIN ? {} : { organizerId: actor.id };
}
