import type { User } from '../../generated/prisma/client.js';
import type { UserListItem } from '@ers/shared';

export function toUserListItem(user: User): UserListItem {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
