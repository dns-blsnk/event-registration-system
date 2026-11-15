import {
  API_PREFIX,
  ErrorCode,
  GITHUB_SIGN_IN_ERROR_PARAM,
  type AuthProviders,
  type GithubSignInError,
} from '@ers/shared';
import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/auth/access.decorator.js';
import { DomainError } from '../../common/errors/domain-error.js';
import { MINUTE_MS } from '../../common/time.js';
import { InjectConfig } from '../../config/config.module.js';

import { startGithubAuthorization } from './github-oauth.js';
import { GithubSignInService } from './github-sign-in.service.js';
import { githubStateCookieName, githubStateCookieOptions } from './github-state-cookie.js';
import {
  clearSessionCookieOptions,
  readSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from './session-cookie.js';

import type { Config } from '../../config/config.schema.js';
import type { Request, Response } from 'express';

/** A person starts a GitHub sign-in a few times a minute at most; each start costs GitHub calls. */
const GITHUB_SIGN_INS_PER_MINUTE = 20;
const AUTH_ROUTE = 'auth';
const GITHUB_CALLBACK_ROUTE = 'github/callback';

@Controller(AUTH_ROUTE)
export class GithubAuthController {
  constructor(
    private readonly signIn: GithubSignInService,
    @InjectConfig() private readonly config: Config,
  ) {}

  /** Lets the sign-in page show the GitHub button only when it works. */
  @Public()
  @Get('providers')
  providers(): AuthProviders {
    return { github: this.config.github !== undefined };
  }

  /** Sends the browser to GitHub, remembering state and the PKCE verifier in a short-lived cookie. */
  @Public()
  @Get('github')
  @Throttle({ default: { limit: GITHUB_SIGN_INS_PER_MINUTE, ttl: MINUTE_MS } })
  start(@Res() response: Response): void {
    const github = this.config.github;
    if (github === undefined) {
      throw new DomainError(ErrorCode.NOT_FOUND, 'GitHub sign-in is not enabled', undefined, true);
    }
    const { url, cookieValue } = startGithubAuthorization(github.clientId, this.redirectUri);
    response.cookie(
      githubStateCookieName(this.config),
      cookieValue,
      githubStateCookieOptions(this.config),
    );
    response.redirect(url);
  }

  /**
   * GitHub sends the browser back here. A plain GET is safe without the CSRF header: nothing
   * happens unless the state matches the cookie this browser got when it started.
   */
  @Public()
  @Get(GITHUB_CALLBACK_ROUTE)
  @Throttle({ default: { limit: GITHUB_SIGN_INS_PER_MINUTE, ttl: MINUTE_MS } })
  async callback(
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const cookieName = githubStateCookieName(this.config);
    // One use only, whatever the outcome.
    response.clearCookie(cookieName, clearSessionCookieOptions(this.config));
    const result = await this.signIn.complete({
      code,
      state,
      stateCookie: request.cookies[cookieName],
      redirectUri: this.redirectUri,
      meta: { ip: request.ip, userAgent: request.get('user-agent') },
      previousToken: readSessionToken(request, this.config),
    });
    if (typeof result === 'string') {
      response.redirect(this.failureUrl(result));
      return;
    }
    response.cookie(
      sessionCookieName(this.config),
      result.session.token,
      sessionCookieOptions(this.config, result.session.expiresAt),
    );
    response.redirect(`${this.config.adminOrigin}/`);
  }

  /** Through the admin's own origin, so the session cookie is first-party (Vercel rewrites /api). */
  private get redirectUri(): string {
    return `${this.config.adminOrigin}/${API_PREFIX}/${AUTH_ROUTE}/${GITHUB_CALLBACK_ROUTE}`;
  }

  private failureUrl(error: GithubSignInError): string {
    const url = new URL('/login', this.config.adminOrigin);
    url.searchParams.set(GITHUB_SIGN_IN_ERROR_PARAM, error);
    return url.toString();
  }
}
