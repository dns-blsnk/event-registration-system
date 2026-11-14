import { Controller, Get } from '@nestjs/common';

import { Public } from '../../src/common/auth/public.decorator.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

/** Test-only route that runs a real query, to exercise the database failure path end to end. */
@Public()
@Controller('test-db')
export class DatabaseFixtureController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('count')
  async count(): Promise<{ logs: number }> {
    return { logs: await this.prisma.appLog.count() };
  }
}
