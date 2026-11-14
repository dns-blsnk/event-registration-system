const PERCENT = 100;

/** A 0..1 share as a whole percentage, e.g. 0.874 -> "87%". Used by admin tables and help texts. */
export function formatPercent(share: number): string {
  return `${String(Math.round(share * PERCENT))}%`;
}
