import { NAME_MAX_LENGTH, Role, type GithubSignInError } from '@ers/shared';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { DomainError } from '../../../common/errors/domain-error.js';
import { PrismaErrorCode, prismaErrorCode } from '../../../common/errors/prisma-errors.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { SessionService, type SessionMeta } from '../../identity/session.service.js';
import { normalizeEmail } from '../email.js';

import { GithubClient, type GithubProfile } from './github-client.js';
import { verifyGithubReturn } from './github-oauth.js';

import type { User } from '../../../generated/prisma/client.js';
import type { SignInResult } from '../sign-in-result.js';

/** What the browser brought back from GitHub; nothing here is trusted yet. */
export interface GithubCallback {
  code: unknown;
  state: unknown;
  stateCookie: unknown;
  redirectUri: string;
  meta: SessionMeta;
  previousToken: string | undefined;
}

/**
 * Signs a GitHub account in. The same GitHub account is the same user; an unknown account gets a
 * new customer. An email that already has an account is refused, never linked: signup does not
 * verify emails, so whoever registered it first may not own it (and staff must not gain a second
 * way in). Staff roles are only ever given by an admin.
 */
@Injectable()
export class GithubSignInService {
  constructor(
    private readonly github: GithubClient,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GithubSignInService.name);
  }

  async complete(callback: GithubCallback): Promise<SignInResult | GithubSignInError> {
    // The state ties the return to the browser that started it (no login CSRF).
    const verifier = verifyGithubReturn(callback.stateCookie, callback.state);
    const { code } = callback;
    if (verifier === undefined || typeof code !== 'string' || code === '') return 'failed';
    const profile = await this.fetchProfile({ code, verifier, redirectUri: callback.redirectUri });
    if (profile === undefined) return 'failed';
    const user = await this.findOrCreate(profile);
    if (typeof user === 'string') {
      this.logger.info({ reason: user }, 'GitHub sign-in refused');
      return user;
    }
    const session = await this.sessions.create(user.id, callback.meta);
    // A fresh session, as for a password login: a session planted earlier never gets signed in.
    // Revoked only once the new one exists, so a failure here never leaves the user signed out.
    if (callback.previousToken !== undefined) await this.sessions.revoke(callback.previousToken);
    this.logger.info({ userId: user.id }, 'user signed in with GitHub');
    return { user, session };
  }

  /** GitHub being down or refusing the code is an expected outcome: the user is sent back to retry. */
  private async fetchProfile(input: {
    code: string;
    verifier: string;
    redirectUri: string;
  }): Promise<GithubProfile | undefined> {
    try {
      return await this.github.fetchProfile(await this.github.exchangeCode(input));
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      this.logger.warn({ err: error }, 'GitHub sign-in failed');
      return undefined;
    }
  }

  private async findOrCreate(profile: GithubProfile): Promise<User | GithubSignInError> {
    const known = await this.prisma.user.findUnique({ where: { githubId: profile.id } });
    if (known !== null) return known;
    if (profile.email === undefined) return 'no-verified-email';
    const email = normalizeEmail(profile.email);
    if ((await this.prisma.user.findUnique({ where: { email } })) !== null) return 'email-in-use';
    try {
      return await this.prisma.user.create({
        data: {
          email,
          name: displayName(profile, email),
          role: Role.CUSTOMER,
          githubId: profile.id,
        },
      });
    } catch (error) {
      if (prismaErrorCode(error) !== PrismaErrorCode.UNIQUE_VIOLATION) throw error;
      // A second tab finished the same sign-in first: use the account it created.
      const created = await this.prisma.user.findUnique({ where: { githubId: profile.id } });
      return created ?? 'email-in-use';
    }
  }
}

/** The GitHub name (or login), else the email, cut to what the column holds. */
function displayName(profile: GithubProfile, email: string): string {
  return (profile.name === '' ? email : profile.name).slice(0, NAME_MAX_LENGTH);
}
