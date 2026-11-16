const TRUNCATION_MARK = '…';

/** Shortens text to fit a column, marking the cut. */
export function clip(value: string, limit: number): string {
  return value.length <= limit
    ? value
    : value.slice(0, limit - TRUNCATION_MARK.length) + TRUNCATION_MARK;
}
