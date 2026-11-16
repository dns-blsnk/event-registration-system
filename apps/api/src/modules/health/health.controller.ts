import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../../common/auth/access.decorator.js';

import { HealthService, type HealthStatus } from './health.service.js';

import type { Response } from 'express';

export const HEALTH_ROUTE = 'health';

@Controller(HEALTH_ROUTE)
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * 200 when every dependency is up, 503 otherwise, so uptime checks and deploy smoke tests fail.
   * Not throttled: the throttle counts in Redis, and the probe must still answer when Redis is down.
   */
  @Public()
  @SkipThrottle()
  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthStatus> {
    const result = await this.health.check();
    res.status(result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
