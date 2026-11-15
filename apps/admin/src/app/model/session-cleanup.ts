import { hasSignedOut, subscribeToSignOut } from '@/entities/viewer';
import { forgetWidths } from '@/shared/ui/column-widths';

import type { QueryClient } from '@tanstack/react-query';

/**
 * What the tab holds for one person and must not show the next one: every cached answer from the
 * API (records and the signed-in identity alike) and the column widths they set.
 */
export function forgetPersonalStateOnSignOut(queryClient: QueryClient): void {
  subscribeToSignOut(() => {
    if (!hasSignedOut()) return;
    queryClient.clear();
    forgetWidths();
  });
}
