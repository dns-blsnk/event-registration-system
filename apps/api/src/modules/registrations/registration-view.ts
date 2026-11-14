import type { Prisma } from '../../generated/prisma/client.js';
import type { RegistrationListItem } from '@ers/shared';

export const REGISTRATION_INCLUDE = {
  customer: { select: { id: true, name: true, email: true } },
  session: {
    select: { id: true, title: true, startsAt: true, event: { select: { id: true, title: true } } },
  },
} satisfies Prisma.RegistrationInclude;

export type RegistrationWithRelations = Prisma.RegistrationGetPayload<{
  include: typeof REGISTRATION_INCLUDE;
}>;

export function toRegistrationListItem(row: RegistrationWithRelations): RegistrationListItem {
  const { session } = row;
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    customer: row.customer,
    session: { id: session.id, title: session.title, startsAt: session.startsAt.toISOString() },
    event: session.event,
  };
}
