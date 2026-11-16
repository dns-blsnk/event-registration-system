import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { CredentialsService } from './local/credentials.service.js';
import { RegistrationService } from './local/registration.service.js';
import {
  SessionService,
  type CreatedSession,
  type SessionMeta,
} from './session/session.service.js';

import type { User } from '../../generated/prisma/client.js';
import type { LoginDto } from './dto/login.dto.js';
import type { SignupDto } from './dto/signup.dto.js';

export interface SignInResult {
  user: User;
  session: CreatedSession;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly registration: RegistrationService,
    private readonly credentials: CredentialsService,
    private readonly sessions: SessionService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async signup(dto: SignupDto, meta: SessionMeta): Promise<SignInResult> {
    const user = await this.registration.registerCustomer(dto);
    this.logger.info({ userId: user.id }, 'user signed up');
    return { user, session: await this.sessions.create(user.id, meta) };
  }

  /**
   * Verifies credentials and starts a fresh session. Any session the browser already had is
   * revoked first, so a session id planted before login can never become authenticated.
   */
  async login(
    dto: LoginDto,
    meta: SessionMeta,
    previousToken: string | undefined,
  ): Promise<SignInResult> {
    // Verify first: a failed attempt must not sign out whoever is currently signed in.
    const user = await this.credentials.verify(dto.email, dto.password, meta.ip);
    if (previousToken !== undefined) {
      await this.sessions.revoke(previousToken);
    }
    this.logger.info({ userId: user.id }, 'user logged in');
    return { user, session: await this.sessions.create(user.id, meta) };
  }

  async logout(token: string): Promise<void> {
    await this.sessions.revoke(token);
  }
}
