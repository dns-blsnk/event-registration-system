import { ErrorCode } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';

import { normalizeEmail } from './email.js';
import { LoginAttemptLimiter } from './login-attempt-limiter.js';
import { PasswordService } from './password.service.js';

import type { User } from '../../generated/prisma/client.js';

/** Same message for unknown email and wrong password, so it cannot be used to find accounts. */
const INVALID_CREDENTIALS = 'Invalid email or password';

/** Checks an email and password, with brute-force protection per client and per account. */
@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly limiter: LoginAttemptLimiter,
  ) {}

  async verify(rawEmail: string, password: string, clientIp: string | undefined): Promise<User> {
    const email = normalizeEmail(rawEmail);
    const ip = clientIp ?? 'unknown';
    if (!(await this.limiter.allowAttempt(ip, email))) {
      throw new DomainError(ErrorCode.RATE_LIMITED, 'Too many failed attempts. Try again later.');
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    const isValid = await this.passwords.verify(user?.passwordHash, password);
    if (user === null || !isValid) {
      throw new DomainError(ErrorCode.UNAUTHENTICATED, INVALID_CREDENTIALS);
    }
    await this.limiter.recordSuccess(ip, email);
    return user;
  }
}
