import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';

export type CheckStatus = 'up' | 'down';

/** Probe body for uptime checks. Not an error body: a degraded service still answers with this shape. */
export interface HealthStatus {
  status: 'ok' | 'degraded';
  checks: { database: CheckStatus };
  uptimeSeconds: number;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthStatus> {
    const database = await this.checkDatabase();
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      checks: { database },
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  /** Bounded by the pool's connect and statement timeouts, so a dead database cannot hang the probe. */
  private async checkDatabase(): Promise<CheckStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      // A failed probe is the expected "down" signal, not an error to rethrow.
      return 'down';
    }
  }
}
