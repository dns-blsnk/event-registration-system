import { useCanWithoutCache, useResourceParams, useWarnAboutChange } from '@refinedev/core';
import { useNavigate } from 'react-router';

import { listUrl } from '@/shared/lib/list-url';

import { listFilterValues, type OpenList } from './list-to-open';
import { ASSISTANT_LIST_STATE } from './use-assistant-page-key';

/** Whether the user may open the list; a failed check counts as no. */
async function mayList(
  can: ReturnType<typeof useCanWithoutCache>['can'],
  resource: string,
): Promise<boolean> {
  try {
    return (await can?.({ resource, action: 'list' }))?.can === true;
  } catch {
    // Recovered on purpose: without an answer the list is simply not opened.
    return false;
  }
}

/**
 * Opens a list the assistant asked for, with its filters, on the first page. The user's own
 * permissions decide first, as for every link in the admin. The router's navigation goes through
 * the unsaved-changes warning; the assistant itself never leaves a page with unsaved changes.
 * The history entry is marked, so the page reads the list's filters anew (see useAssistantPageKey).
 */
export function useOpenList(): OpenList {
  const navigate = useNavigate();
  const { can } = useCanWithoutCache();
  const { warnWhen } = useWarnAboutChange();
  const { resources } = useResourceParams();
  return async (list, { automatic, isWanted }) => {
    const path = resources.find((resource) => resource.name === list.resource)?.list;
    if (typeof path !== 'string' || !(await mayList(can, list.resource))) return 'skipped';
    if (!isWanted()) return 'skipped';
    if (automatic && warnWhen) return 'held';
    // Not awaited: with a browser router navigation is synchronous; nothing waits for it.
    void navigate(listUrl(path, listFilterValues(list)), {
      state: { [ASSISTANT_LIST_STATE]: crypto.randomUUID() },
    });
    return 'opened';
  };
}
