import type { AuthSession, User } from '../../generated/prisma/client.js';

export interface AuthContext {
  user: User;
  session: AuthSession;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express request typing is extended through this global namespace
  namespace Express {
    interface Request {
      /** Set by AuthGuard when the request carries a valid session cookie. */
      auth?: AuthContext;
    }
  }
}
