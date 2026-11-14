import type { RegistrationStatus } from './domain.js';

/** A customer's own booking, as "My registrations" shows it. */
export interface MyRegistration {
  id: string;
  status: RegistrationStatus;
  createdAt: string;
  cancelledAt: string | null;
  /** 1-based place in the waitlist; null unless WAITLISTED. */
  waitlistPosition: number | null;
  session: { id: string; title: string; room: string | null; startsAt: string; endsAt: string };
  event: { id: string; title: string; city: string; venue: string };
}
