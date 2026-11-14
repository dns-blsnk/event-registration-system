import { eventScope } from '../events/event-scope.js';

import type { Prisma, User } from '../../generated/prisma/client.js';

/** Staff row-level access: admins see every registration, organizers those of their own events. */
export function registrationScope(actor: Pick<User, 'id' | 'role'>): Prisma.RegistrationWhereInput {
  return { session: { event: eventScope(actor) } };
}
