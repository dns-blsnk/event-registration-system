import { ALMOST_FULL_RATIO } from '@ers/shared';

export interface SeatCounts {
  capacity: number;
  confirmedCount: number;
}

/** Clamped for display; the database CHECK (confirmed_count <= capacity) prevents overbooking itself. */
export function seatsLeft({ capacity, confirmedCount }: SeatCounts): number {
  return Math.max(capacity - confirmedCount, 0);
}

/** Share of seats taken, 0..1. */
export function fillRate({ capacity, confirmedCount }: SeatCounts): number {
  return capacity === 0 ? 1 : Math.min(confirmedCount / capacity, 1);
}

export function isAlmostFull(seats: SeatCounts): boolean {
  return fillRate(seats) >= ALMOST_FULL_RATIO;
}
