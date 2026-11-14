import { Controller, Get } from '@nestjs/common';

export const HEALTH_ROUTE = 'health';

export interface HealthStatus {
  status: 'ok';
  uptimeSeconds: number;
}

@Controller(HEALTH_ROUTE)
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }
}
