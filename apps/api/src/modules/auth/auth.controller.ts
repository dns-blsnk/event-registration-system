import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { Public, SignedIn } from '../../common/auth/access.decorator.js';
import { CurrentAuth } from '../../common/auth/current-user.decorator.js';
import { SkipCsrfToken } from '../../common/auth/skip-csrf-token.decorator.js';
import { MINUTE_MS } from '../../common/time.js';
import { InjectConfig } from '../../config/config.module.js';
import {
  clearSessionCookieOptions,
  readSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from '../identity/session-cookie.js';

import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { SignupDto } from './dto/signup.dto.js';
import { toPublicUser } from './public-user.js';

import type { AuthContext } from '../../common/auth/auth-context.js';
import type { Config } from '../../config/config.schema.js';
import type { SessionMeta } from '../identity/session.service.js';
import type { SignInResult } from './sign-in-result.js';
import type { AuthResponse, SessionResponse } from '@ers/shared';
import type { Request, Response } from 'express';

const SIGNUPS_PER_MINUTE = 10;
/** Per IP, on top of the per-account failure limits in LoginAttemptLimiter (argon2 is expensive). */
const LOGINS_PER_MINUTE = 30;

function metaOf(request: Request): SessionMeta {
  return { ip: request.ip, userAgent: request.get('user-agent') };
}

/** The one shape of "who is signed in", for /auth/me and /auth/session alike. */
function toAuthResponse(auth: AuthContext): AuthResponse {
  return { user: toPublicUser(auth.user), csrfToken: auth.session.csrfToken };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @InjectConfig() private readonly config: Config,
  ) {}

  @Public()
  @SkipCsrfToken()
  @Post('signup')
  @Throttle({ default: { limit: SIGNUPS_PER_MINUTE, ttl: MINUTE_MS } })
  async signup(
    @Body() dto: SignupDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.startSession(await this.auth.signup(dto, metaOf(request)), response);
  }

  /** Failed attempts are also limited per account by LoginAttemptLimiter inside CredentialsService. */
  @Public()
  @SkipCsrfToken()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: LOGINS_PER_MINUTE, ttl: MINUTE_MS } })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const signedIn = await this.auth.login(
      dto,
      metaOf(request),
      readSessionToken(request, this.config),
    );
    return this.startSession(signedIn, response);
  }

  /** Public so an expired session can still clear its cookie; a live session needs the CSRF token. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = readSessionToken(request, this.config);
    if (token !== undefined) {
      await this.auth.logout(token);
    }
    response.clearCookie(sessionCookieName(this.config), clearSessionCookieOptions(this.config));
  }

  /** Who is signed in, or no one; public, so the admin can ask before anyone signs in. */
  @Public()
  @Get('session')
  session(@Req() request: Request): SessionResponse {
    const { auth } = request;
    return auth === undefined ? { user: null, csrfToken: null } : toAuthResponse(auth);
  }

  @SignedIn()
  @Get('me')
  me(@CurrentAuth() auth: AuthContext): AuthResponse {
    return toAuthResponse(auth);
  }

  private startSession({ user, session }: SignInResult, response: Response): AuthResponse {
    response.cookie(
      sessionCookieName(this.config),
      session.token,
      sessionCookieOptions(this.config, session.expiresAt),
    );
    return { user: toPublicUser(user), csrfToken: session.csrfToken };
  }
}
