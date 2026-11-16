import { Action, Resource } from '@ers/shared';
import { Controller, Get, Post } from '@nestjs/common';

import { RequirePermission, SignedIn } from '../../src/common/auth/access.decorator.js';

/** Test-only routes, one per kind of access rule. */
@Controller('test-permissions')
export class PermissionsFixtureController {
  @RequirePermission(Resource.USERS, Action.LIST)
  @Get('users')
  users(): { ok: true } {
    return { ok: true };
  }

  @RequirePermission(Resource.EVENTS, Action.CREATE)
  @Post('events')
  createEvent(): { ok: true } {
    return { ok: true };
  }

  @RequirePermission(Resource.MY_REGISTRATIONS, Action.LIST)
  @Get('my-registrations')
  myRegistrations(): { ok: true } {
    return { ok: true };
  }

  @SignedIn()
  @Get('signed-in')
  signedIn(): { ok: true } {
    return { ok: true };
  }

  @Get('undeclared')
  undeclared(): { ok: true } {
    return { ok: true };
  }
}
