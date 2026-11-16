import { Module } from '@nestjs/common';

import { SessionService } from './session.service.js';
import { SignOutHooks } from './sign-out-hooks.js';

/**
 * Who is signed in: server-side sessions. Its own module because more than sign-in needs it: the
 * global guards, the help chat and user management. The module provides SessionService; other
 * modules reach it and the session cookie and token helpers through index.ts.
 */
@Module({ providers: [SessionService, SignOutHooks], exports: [SessionService, SignOutHooks] })
export class IdentityModule {}
