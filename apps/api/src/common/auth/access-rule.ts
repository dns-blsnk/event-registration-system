import { ACCESS_KEY, type AccessRule } from './access.decorator.js';

import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

/** The route's access rule: the method's own rule wins over the controller's. */
export function accessRuleOf(
  reflector: Reflector,
  context: ExecutionContext,
): AccessRule | undefined {
  return reflector.getAllAndOverride<AccessRule | undefined>(ACCESS_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
}
