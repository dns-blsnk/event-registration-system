import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

/** OWASP Password Storage Cheat Sheet minimum for argon2id: 19 MiB memory, 2 iterations, 1 lane. */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const DUMMY_PASSWORD = 'dummy-password-for-timing-equalisation';

@Injectable()
export class PasswordService {
  /**
   * A real hash to verify against when the user has no usable hash, so response timing does not
   * reveal which accounts exist. Started at construction; verify() waits for it.
   */
  private readonly dummyHash: Promise<string> = this.hash(DUMMY_PASSWORD);

  async hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  /** Always does the same amount of work, whether or not a valid hash exists. */
  async verify(hash: string | null | undefined, password: string): Promise<boolean> {
    const isUsable = typeof hash === 'string' && hash.startsWith('$argon2');
    const target = isUsable ? hash : await this.dummyHash;
    try {
      const matches = await argon2.verify(target, password);
      return matches && isUsable;
    } catch {
      // A corrupt stored hash is a failed login, not a server error.
      return false;
    }
  }
}
