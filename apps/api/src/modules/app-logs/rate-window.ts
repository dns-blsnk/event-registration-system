/** Fixed-window counter that caps how many entries are accepted per window. */
export class RateWindow {
  private windowStart = 0;
  private acceptedInWindow = 0;
  private rejected = 0;

  constructor(
    private readonly maxPerWindow: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns true if the entry may be recorded. */
  tryAccept(): boolean {
    const current = this.now();
    if (current - this.windowStart >= this.windowMs) {
      this.windowStart = current;
      this.acceptedInWindow = 0;
    }
    if (this.acceptedInWindow >= this.maxPerWindow) {
      this.rejected += 1;
      return false;
    }
    this.acceptedInWindow += 1;
    return true;
  }

  /** Returns how many entries were rejected since the last call and resets the counter. */
  takeRejectedCount(): number {
    const count = this.rejected;
    this.rejected = 0;
    return count;
  }
}
