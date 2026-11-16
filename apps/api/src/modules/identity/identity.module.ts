import { Module } from '@nestjs/common';

import { SessionService } from './session.service.js';

/**
 * Who is signed in: server-side sessions. Its own module because more than sign-in needs it: the
 * global guards, the help chat and user management. The module provides SessionService; the
 * session cookie and token helpers next to it are plain functions, imported directly.
 */
@Module({ providers: [SessionService], exports: [SessionService] })
export class IdentityModule {}
