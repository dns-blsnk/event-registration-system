import type { EventStatus, RegistrationStatus } from '@ers/shared';

/** Theme colours a status chip can take. */
export type StatusColor = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';

/** One colour per event status, so a list of events can be read at a glance. */
export const EVENT_STATUS_COLORS: Readonly<Record<EventStatus, StatusColor>> = {
  DRAFT: 'default',
  PUBLISHED: 'primary',
  COMPLETED: 'secondary',
  CANCELLED: 'error',
};

/** One colour per registration status: a seat, a waitlist place, attendance, or nothing. */
export const REGISTRATION_STATUS_COLORS: Readonly<Record<RegistrationStatus, StatusColor>> = {
  CONFIRMED: 'success',
  WAITLISTED: 'warning',
  ATTENDED: 'primary',
  CANCELLED: 'default',
};
