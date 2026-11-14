/**
 * Bounded FIFO queue. When full, the oldest item is dropped so recent failures are kept.
 * Array-backed: at 1000 items shift() costs microseconds, so a ring buffer is not worth it.
 */
export class LogBuffer<T> {
  private readonly items: T[] = [];
  private droppedCount = 0;

  constructor(private readonly capacity: number) {}

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    if (this.items.length >= this.capacity) {
      this.items.shift();
      this.droppedCount += 1;
    }
    this.items.push(item);
  }

  /** Removes and returns up to `max` of the oldest items. */
  take(max: number): T[] {
    return this.items.splice(0, max);
  }

  /** Puts items that failed to persist back at the front, keeping the capacity limit. */
  restore(batch: readonly T[]): void {
    const room = Math.max(this.capacity - this.items.length, 0);
    const kept = batch.slice(batch.length - Math.min(room, batch.length));
    this.droppedCount += batch.length - kept.length;
    this.items.unshift(...kept);
  }

  /** Returns how many items were dropped since the last call and resets the counter. */
  takeDroppedCount(): number {
    const count = this.droppedCount;
    this.droppedCount = 0;
    return count;
  }
}
