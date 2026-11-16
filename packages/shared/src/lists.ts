/** Largest page the API returns; the admin never asks for more. */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;
/** Response header with the total row count for paginated lists (Refine simple-rest). */
export const TOTAL_COUNT_HEADER = 'x-total-count';
/** Longest free-text list filter (search, city); the API cuts longer values to this. */
export const LIST_TEXT_FILTER_MAX_LENGTH = 100;
/** A record id in list filters. */
export const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
/** A calendar day in list filters, as date pickers send it. */
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
