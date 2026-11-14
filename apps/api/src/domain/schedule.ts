export interface TimeRange {
  startsAt: Date;
  endsAt: Date;
}

/** Half-open ranges [start, end): a session ending at 10:00 does not overlap one starting at 10:00. */
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();
}

export function isValidRange(range: TimeRange): boolean {
  return range.endsAt.getTime() > range.startsAt.getTime();
}

/** A session must take place within its event's dates. */
export function isWithin(inner: TimeRange, outer: TimeRange): boolean {
  return (
    inner.startsAt.getTime() >= outer.startsAt.getTime() &&
    inner.endsAt.getTime() <= outer.endsAt.getTime()
  );
}
