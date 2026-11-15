import { RegistrationStatus, type EventStatus } from './domain.js';

import type { ErrorCode } from './errors.js';

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

/** A registration as staff see it in the admin. */
export interface RegistrationListItem {
  id: string;
  status: RegistrationStatus;
  createdAt: string;
  cancelledAt: string | null;
  customer: { id: string; name: string; email: string };
  session: { id: string; title: string; startsAt: string };
  event: { id: string; title: string; status: EventStatus };
}

/** Statuses staff can set in bulk: cancel bookings, or record who came. */
export const BULK_TARGET_STATUSES = [
  RegistrationStatus.CANCELLED,
  RegistrationStatus.ATTENDED,
] as const;
export type BulkTargetStatus = (typeof BULK_TARGET_STATUSES)[number];

/** Upper bound on one bulk request, so a single call cannot hold locks for long. */
export const BULK_STATUS_MAX_IDS = 100;

/** Per-row outcome of a bulk status change: each row succeeds or fails on its own. */
export type BulkStatusItemResult =
  | { id: string; ok: true; status: RegistrationStatus }
  | { id: string; ok: false; code: ErrorCode; message: string };

export interface BulkStatusResponse {
  results: BulkStatusItemResult[];
}
