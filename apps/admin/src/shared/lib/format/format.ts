import dayjs from 'dayjs';

const DATE_TIME_FORMAT = 'DD MMM YYYY, HH:mm';

/** Display formats shared by every table and card. */

/** One readable date-time format, in the viewer's time zone. */
export function formatDateTime(iso: string): string {
  return dayjs(iso).format(DATE_TIME_FORMAT);
}
