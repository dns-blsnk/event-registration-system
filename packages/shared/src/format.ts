const PERCENT = 100;

/** A 0..1 share as a whole percentage number, e.g. 0.874 -> 87; what labels and bars both show. */
export function toPercent(share: number): number {
  return Math.round(share * PERCENT);
}

/** A 0..1 share as a whole percentage, e.g. 0.874 -> "87%". Used by admin tables and help texts. */
export function formatPercent(share: number): string {
  return `${String(toPercent(share))}%`;
}

/** Seats left as the sessions list labels them: "Full" at zero, otherwise "<n> left". */
export function seatsLeftLabel(seatsLeft: number): string {
  return seatsLeft === 0 ? 'Full' : `${String(seatsLeft)} left`;
}
