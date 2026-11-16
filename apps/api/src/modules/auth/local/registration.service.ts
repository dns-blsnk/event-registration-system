import { ErrorCode, Role } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../../common/errors/domain-error.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { normalizeEmail } from '../email.js';

import { PasswordService } from './password.service.js';

import type { User } from '../../../generated/prisma/client.js';
import type { SignupDto } from '../dto/signup.dto.js';

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  /** Self-service sign-up always creates a CUSTOMER; elevated roles are granted by an admin. */
  async registerCustomer(dto: SignupDto): Promise<User> {
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing !== null) {
      throw new DomainError(ErrorCode.CONFLICT, 'An account with this email already exists');
    }
    // The unique index still guards against a concurrent sign-up with the same email (P2002 -> 409).
    return this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        passwordHash: await this.passwords.hash(dto.password),
        role: Role.CUSTOMER,
      },
    });
  }
}
