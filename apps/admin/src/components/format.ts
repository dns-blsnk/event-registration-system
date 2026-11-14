import dayjs from 'dayjs';

const DATE_TIME_FORMAT = 'DD MMM YYYY, HH:mm';

/** Display formats shared by every table and card. */

/** One readable date-time format, in the viewer's time zone. */
export function formatDateTime(iso: string): string {
  return dayjs(iso).format(DATE_TIME_FORMAT);
}

const PERCENT = 100;

/** A 0..1 share as a whole percentage, e.g. 0.874 -> "87%". */
export function formatPercent(share: number): string {
  return `${String(Math.round(share * PERCENT))}%`;
}
