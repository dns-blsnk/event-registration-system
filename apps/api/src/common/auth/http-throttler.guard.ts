import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { isHttpContext } from './http-context.js';

/** The HTTP throttle; the chat socket limits messages per user itself, before any work. */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    return isHttpContext(context) ? super.canActivate(context) : true;
  }
}
