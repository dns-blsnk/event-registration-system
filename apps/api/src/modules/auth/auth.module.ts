import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GithubAuthController } from './github/github-auth.controller.js';
import { GithubClient } from './github/github-client.js';
import { GithubSignInService } from './github/github-sign-in.service.js';
import { CredentialsService } from './local/credentials.service.js';
import { LoginAttemptLimiter } from './local/login-attempt-limiter.js';
import { PasswordService } from './local/password.service.js';
import { RegistrationService } from './local/registration.service.js';
import { SessionService } from './session/session.service.js';

@Module({
  controllers: [AuthController, GithubAuthController],
  providers: [
    AuthService,
    CredentialsService,
    GithubClient,
    GithubSignInService,
    LoginAttemptLimiter,
    PasswordService,
    RegistrationService,
    SessionService,
  ],
  exports: [PasswordService, SessionService],
})
export class AuthModule {}
