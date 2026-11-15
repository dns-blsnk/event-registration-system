import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CredentialsService } from './credentials.service.js';
import { GithubAuthController } from './github-auth.controller.js';
import { GithubClient } from './github-client.js';
import { GithubSignInService } from './github-sign-in.service.js';
import { LoginAttemptLimiter } from './login-attempt-limiter.js';
import { PasswordService } from './password.service.js';
import { RegistrationService } from './registration.service.js';
import { SessionService } from './session.service.js';

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
