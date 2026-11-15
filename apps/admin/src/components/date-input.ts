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

/**
 * Native date inputs print their format ("dd.mm.yyyy") in full text colour, unlike the grey
 * placeholders of other fields; these styles grey an empty one until it is focused.
 */
const PLACEHOLDER_LOOK = { color: 'text.disabled' } as const;

/** For a required date field: the browser marks it :invalid while it is empty (or half typed). */
export const REQUIRED_DATE_SX = { '& input:invalid:not(:focus)': PLACEHOLDER_LOOK } as const;

/** For an optional date field whose emptiness the caller knows. */
export const EMPTY_DATE_SX = { '& input:not(:focus)': PLACEHOLDER_LOOK } as const;
