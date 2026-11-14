/** Event lifecycle. Values match the Prisma `EventStatus` enum. */
export const EventStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const EVENT_STATUSES: readonly EventStatus[] = Object.values(EventStatus);

/** Registration lifecycle. Values match the Prisma `RegistrationStatus` enum. */
export const RegistrationStatus = {
  CONFIRMED: 'CONFIRMED',
  WAITLISTED: 'WAITLISTED',
  CANCELLED: 'CANCELLED',
  ATTENDED: 'ATTENDED',
} as const;

export type RegistrationStatus = (typeof RegistrationStatus)[keyof typeof RegistrationStatus];

export const REGISTRATION_STATUSES: readonly RegistrationStatus[] =
  Object.values(RegistrationStatus);

/** A session counts as "almost full" from this share of seats taken. */
export const ALMOST_FULL_RATIO = 0.9;
