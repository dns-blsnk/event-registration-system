import {
  ErrorCode,
  RegistrationStatus,
  type BulkStatusItemResult,
  type BulkTargetStatus,
} from '@ers/shared';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { DomainError } from '../../common/errors/domain-error.js';
import { translatePrismaError } from '../../common/errors/prisma-errors.js';
import { assertCanRecordAttendance } from '../../domain/registration-rules.js';
import { assertRegistrationTransition } from '../../domain/status-transitions.js';
import { PrismaService } from '../../prisma/prisma.service.js';

import { BookingService } from './booking.service.js';
import { lockVisibleRegistration } from './registration-locks.js';
import { registrationScope } from './registration-scope.js';

import type { Prisma, Registration, User } from '../../generated/prisma/client.js';

const NOT_PROCESSED_MESSAGE = 'Database unavailable, not processed';

/** Staff status changes. Every row runs in its own transaction, so one failure never blocks the rest. */
@Injectable()
export class RegistrationStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly booking: BookingService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RegistrationStatusService.name);
  }

  async bulkChange(
    ids: readonly string[],
    status: BulkTargetStatus,
    actor: User,
    now: Date = new Date(),
  ): Promise<BulkStatusItemResult[]> {
    const scope = registrationScope(actor);
    const results: BulkStatusItemResult[] = [];
    let databaseDown = false;
    for (const id of new Set(ids)) {
      if (databaseDown) {
        results.push({
          id,
          ok: false,
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: NOT_PROCESSED_MESSAGE,
        });
        continue;
      }
      const result = await this.changeOne(id, status, scope, now);
      databaseDown = !result.ok && result.code === ErrorCode.SERVICE_UNAVAILABLE;
      results.push(result);
    }
    const succeeded = results.filter((result) => result.ok).length;
    this.logger.info(
      { actorId: actor.id, status, requested: results.length, succeeded },
      'bulk registration status change',
    );
    return results;
  }

  /**
   * Rows commit one by one, so every outcome is reported per row rather than failing the request
   * halfway: rows before an unexpected error are already changed and the admin must see that.
   */
  private async changeOne(
    id: string,
    status: BulkTargetStatus,
    scope: Prisma.RegistrationWhereInput,
    now: Date,
  ): Promise<BulkStatusItemResult> {
    try {
      const updated =
        status === RegistrationStatus.CANCELLED
          ? await this.booking.cancel(id, { scope, byStaff: true, now })
          : await this.markAttended(id, scope, now);
      return { id, ok: true, status: updated.status };
    } catch (error) {
      const domainError = error instanceof DomainError ? error : translatePrismaError(error);
      if (domainError === undefined || domainError.code === ErrorCode.SERVICE_UNAVAILABLE) {
        // Swallowed into the report, so logged here; the global filter never sees it.
        this.logger.error(
          { err: error, registrationId: id },
          'bulk status change failed for a row',
        );
      }
      if (domainError === undefined) {
        return {
          id,
          ok: false,
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Unexpected error, not changed',
        };
      }
      return { id, ok: false, code: domainError.code, message: domainError.message };
    }
  }

  /** Attendance keeps the seat (ATTENDED counts as taken) and can only be recorded once the session starts. */
  private async markAttended(
    id: string,
    scope: Prisma.RegistrationWhereInput,
    now: Date,
  ): Promise<Registration> {
    return this.prisma.$transaction(async (tx) => {
      const registration = await lockVisibleRegistration(tx, id, scope);
      assertCanRecordAttendance(registration.session.event);
      assertRegistrationTransition(registration.status, RegistrationStatus.ATTENDED, {
        manual: true,
        timing: { startsAt: registration.session.startsAt, now },
      });
      return tx.registration.update({
        where: { id },
        data: { status: RegistrationStatus.ATTENDED },
      });
    });
  }
}
