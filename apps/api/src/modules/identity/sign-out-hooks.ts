import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

/** Clean-up for a user who has signed out or lost all their sessions. */
export type SignOutHook = (userId: string) => Promise<void>;

/**
 * Lets other modules forget what they keep for a user when the user signs out, without identity
 * knowing about them: the help chat registers here to drop the user's chats. A failing hook is
 * logged and does not undo the sign-out, which has already happened in the database.
 */
@Injectable()
export class SignOutHooks {
  private readonly hooks: SignOutHook[] = [];

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(SignOutHooks.name);
  }

  register(hook: SignOutHook): void {
    this.hooks.push(hook);
  }

  async run(userId: string): Promise<void> {
    const results = await Promise.allSettled(this.hooks.map((hook) => hook(userId)));
    for (const result of results) {
      if (result.status === 'rejected') {
        const error: unknown = result.reason;
        // Name and message only: an error from a store can carry the data it failed to write.
        const err = error instanceof Error ? { name: error.name, message: error.message } : {};
        this.logger.warn({ err, userId }, 'sign-out clean-up failed');
      }
    }
  }
}
