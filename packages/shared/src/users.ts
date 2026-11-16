import type { PublicUser } from './auth.js';

/** A user as the admin's Users page shows it. */
export interface UserListItem extends PublicUser {
  createdAt: string;
}
