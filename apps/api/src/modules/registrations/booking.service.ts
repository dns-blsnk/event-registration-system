import { ErrorCode, HELD_REGISTRATION_STATUSES, RegistrationStatus } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import {
  assertCanCancel,
  assertCanRegister,
  assertNoScheduleConflict,
  hasScheduleConflict,
} from '../../domain/registration-rules.js';
import { assertRegistrationTransition } from '../../domain/status-transitions.js';
import { PrismaService } from '../../prisma/prisma.service.js';

import {
  lockSession,
  lockVisibleRegistration,
  releaseSeat,
  takeSeat,
} from './registration-locks.js';
import { confirmedSessionsOf, promoteFromWaitlist } from './waitlist.js';

import type { Prisma, Registration, Session } from '../../generated/prisma/client.js';

/**
 * Seat booking: one seat per customer and session, a confirmed seat while any are free, the
 * waitlist otherwise, and automatic promotion when a confirmed seat is given up.
 */
@Injectable()
export class BookingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Books a seat (CONFIRMED) or a waitlist place (WAITLISTED). The waitlist is served first, so a
   * new booker never takes a seat someone eligible is queuing for. A schedule conflict blocks a
   * confirmed seat but not a waitlist place (promotion re-checks it). Booking again after
   * cancelling reuses the row.
   */
  async book(sessionId: string, customerId: string, now: Date = new Date()): Promise<Registration> {
    return this.prisma.$transaction(async (tx) => {
      await lockSession(tx, sessionId);
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { event: true },
      });
      if (session === null) {
        throw new DomainError(ErrorCode.NOT_FOUND, 'Session not found');
      }
      assertCanRegister(session.event, session, now);
      await promoteFromWaitlist(tx, sessionId, now, [customerId]);
      const existing = await tx.registration.findUnique({
        where: { sessionId_customerId: { sessionId, customerId } },
      });
      if (existing !== null && HELD_REGISTRATION_STATUSES.includes(existing.status)) {
        throw new DomainError(
          ErrorCode.ALREADY_REGISTERED,
          'You are already registered for this session',
        );
      }
      const status = await this.decideStatus(tx, session, customerId);
      return this.saveBooking(tx, { sessionId, customerId, status, existing, now });
    });
  }

  /**
   * Cancels an active registration. A freed confirmed seat goes to the waitlist at once.
   * `scope` narrows which registrations the caller may cancel (a customer: their own; staff: their
   * events), `byStaff` relaxes the timing rule for leftover waitlist places.
   */
  async cancel(
    registrationId: string,
    {
      scope,
      byStaff,
      now = new Date(),
    }: { scope: Prisma.RegistrationWhereInput; byStaff: boolean; now?: Date },
  ): Promise<Registration> {
    return this.prisma.$transaction(async (tx) => {
      const registration = await lockVisibleRegistration(tx, registrationId, scope);
      assertCanCancel(registration, registration.session, { byStaff, now });
      assertRegistrationTransition(registration.status, RegistrationStatus.CANCELLED, {
        manual: true,
        timing: { startsAt: registration.session.startsAt, now },
      });
      const cancelled = await tx.registration.update({
        where: { id: registrationId },
        data: { status: RegistrationStatus.CANCELLED, cancelledAt: now },
      });
      if (registration.status === RegistrationStatus.CONFIRMED) {
        await releaseSeat(tx, registration.sessionId);
        await promoteFromWaitlist(tx, registration.sessionId, now);
      }
      return cancelled;
    });
  }

  /** Caller holds the session and customer locks. */
  private async decideStatus(
    tx: Prisma.TransactionClient,
    session: Session,
    customerId: string,
  ): Promise<RegistrationStatus> {
    const confirmed = await confirmedSessionsOf(tx, customerId);
    if (hasScheduleConflict(session, confirmed)) {
      const current = await tx.session.findUniqueOrThrow({ where: { id: session.id } });
      if (current.confirmedCount < current.capacity) {
        assertNoScheduleConflict(session, confirmed);
      }
      return RegistrationStatus.WAITLISTED;
    }
    return (await takeSeat(tx, session.id))
      ? RegistrationStatus.CONFIRMED
      : RegistrationStatus.WAITLISTED;
  }

  private async saveBooking(
    tx: Prisma.TransactionClient,
    booking: {
      sessionId: string;
      customerId: string;
      status: RegistrationStatus;
      existing: Registration | null;
      now: Date;
    },
  ): Promise<Registration> {
    const { sessionId, customerId, status, existing, now } = booking;
    if (existing === null) {
      return tx.registration.create({ data: { sessionId, customerId, status } });
    }
    // The unique (session, customer) row is reused: CANCELLED is terminal for that booking, and this
    // is a new booking, so it starts at the back of the queue (createdAt is the queue time) and
    // the transition table does not apply.
    return tx.registration.update({
      where: { id: existing.id },
      data: { status, cancelledAt: null, createdAt: now },
    });
  }
}
