import type { User } from '../../generated/prisma/client.js';
import type { PublicUser } from '@ers/shared';

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
