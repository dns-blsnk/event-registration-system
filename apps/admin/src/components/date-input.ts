import dayjs from 'dayjs';

const INPUT_DATE_TIME = 'YYYY-MM-DDTHH:mm';

/** An ISO instant as a `datetime-local` value in the viewer's time zone (minutes precision). */
export function toInputDateTime(iso: string): string {
  return dayjs(iso).format(INPUT_DATE_TIME);
}

/** A `datetime-local` value (local time) as the ISO instant the API stores. */
export function fromInputDateTime(local: string): string {
  return new Date(local).toISOString();
}
