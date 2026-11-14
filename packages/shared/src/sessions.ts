export const SESSION_TITLE_MAX_LENGTH = 200;
export const SESSION_SPEAKER_MAX_LENGTH = 120;
export const SESSION_ROOM_MAX_LENGTH = 80;
export const SESSION_MAX_CAPACITY = 10_000;

/** A session row in admin lists with live seat numbers. */
export interface SessionListItem {
  id: string;
  eventId: string;
  eventTitle: string;
  title: string;
  speaker: string | null;
  room: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  confirmedCount: number;
  seatsLeft: number;
  /** Share of seats taken, 0..1. */
  fillRate: number;
  waitlistCount: number;
}
