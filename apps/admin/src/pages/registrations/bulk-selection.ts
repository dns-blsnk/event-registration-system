import {
  BULK_STATUS_MAX_IDS,
  staffActionRefusal,
  type BulkStatusResponse,
  type BulkTargetStatus,
  type RegistrationListItem,
} from '@ers/shared';

/** The selected rows a bulk action applies to, and the others with why they are skipped. */
export interface BulkSelection {
  eligibleIds: string[];
  skippedIds: string[];
  /** Reason → how many rows it skips. */
  skipped: ReadonlyMap<string, number>;
}

/** Splits the selection by the shared staff rules, so rows the API would refuse are not sent. */
export function bulkSelection(
  rows: readonly RegistrationListItem[],
  target: BulkTargetStatus,
  now: Date,
): BulkSelection {
  const eligibleIds: string[] = [];
  const skippedIds: string[] = [];
  const skipped = new Map<string, number>();
  for (const row of rows) {
    const reason = staffActionRefusal(
      {
        status: row.status,
        sessionStartsAt: new Date(row.session.startsAt),
        eventStatus: row.event.status,
      },
      target,
      now,
    );
    if (reason === undefined) {
      eligibleIds.push(row.id);
    } else {
      skippedIds.push(row.id);
      skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
    }
  }
  return { eligibleIds, skippedIds, skipped };
}

function countsText(counts: ReadonlyMap<string, number>): string {
  return [...counts].map(([reason, count]) => `${String(count)} × ${reason}`).join('; ');
}

/** Why an action is off for the current selection, for its tooltip; empty when it is on. */
export function offReason(selection: BulkSelection): string {
  if (selection.eligibleIds.length > BULK_STATUS_MAX_IDS) {
    return `At most ${String(BULK_STATUS_MAX_IDS)} at a time`;
  }
  if (selection.eligibleIds.length === 0 && selection.skipped.size > 0) {
    return `Not possible for the selection: ${countsText(selection.skipped)}`;
  }
  return '';
}

/**
 * The outcome in one line: how many changed, which rows were skipped before sending and why, and
 * any rows the server still refused (another admin changed them meanwhile).
 */
export function bulkSummary(
  response: BulkStatusResponse,
  skipped: ReadonlyMap<string, number> = new Map(),
): { type: 'success' | 'error'; message: string } {
  const refused = new Map<string, number>();
  for (const result of response.results) {
    if (!result.ok) refused.set(result.message, (refused.get(result.message) ?? 0) + 1);
  }
  const changed = response.results.filter((result) => result.ok).length;
  const parts = [`${String(changed)} registration(s) updated`];
  if (skipped.size > 0) parts.push(`Skipped: ${countsText(skipped)}`);
  if (refused.size > 0) parts.push(`Not changed: ${countsText(refused)}`);
  return { type: refused.size > 0 ? 'error' : 'success', message: parts.join('. ') };
}
