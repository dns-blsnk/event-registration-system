import { hasSignedOut, subscribeToSignOut } from '@/entities/viewer';
import { forgetChatId } from '@/features/help-chat';
import { forgetWidths } from '@/shared/ui/column-widths';

import type { QueryClient } from '@tanstack/react-query';

/**
 * What the tab holds for one person and must not show the next one: every cached answer from the
 * API (records and the signed-in identity alike), the column widths they set and their chat with
 * the assistant.
 */
export function forgetPersonalStateOnSignOut(queryClient: QueryClient): void {
  subscribeToSignOut(() => {
    if (!hasSignedOut()) return;
    queryClient.clear();
    forgetWidths();
    forgetChatId();
  });
}
