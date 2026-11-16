import type { User } from '../../generated/prisma/client.js';
import type { CreatedSession } from '../identity/session.service.js';

/** A user who has just signed in, by any method, with the session started for them. */
export interface SignInResult {
  user: User;
  session: CreatedSession;
}
