import { hasSignedOut, subscribeToSignOut } from '@/entities/viewer';
import { forgetWidths } from '@/shared/ui/column-widths';

/** What the tab remembers for one person and must not show the next one: column widths. */
export function forgetPersonalStateOnSignOut(): void {
  subscribeToSignOut(() => {
    if (hasSignedOut()) forgetWidths();
  });
}
