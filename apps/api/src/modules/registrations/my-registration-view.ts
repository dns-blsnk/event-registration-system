import { RegistrationStatus, type MyRegistration } from '@ers/shared';

import type { Prisma } from '../../generated/prisma/client.js';

export const MY_REGISTRATION_INCLUDE = {
  session: {
    select: {
      id: true,
      title: true,
      room: true,
      startsAt: true,
      endsAt: true,
      event: { select: { id: true, title: true, city: true, venue: true } },
    },
  },
} satisfies Prisma.RegistrationInclude;

export type MyRegistrationRow = Prisma.RegistrationGetPayload<{
  include: typeof MY_REGISTRATION_INCLUDE;
}>;

export function toMyRegistration(
  row: MyRegistrationRow,
  waitlistPosition: number | null,
): MyRegistration {
  const { session } = row;
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    waitlistPosition: row.status === RegistrationStatus.WAITLISTED ? waitlistPosition : null,
    session: {
      id: session.id,
      title: session.title,
      room: session.room,
      startsAt: session.startsAt.toISOString(),
      endsAt: session.endsAt.toISOString(),
    },
    event: session.event,
  };
}
