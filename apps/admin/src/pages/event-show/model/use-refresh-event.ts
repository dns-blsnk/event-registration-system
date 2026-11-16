import { Resource } from '@ers/shared';
import { useInvalidate } from '@refinedev/core';
import { useCallback } from 'react';

/**
 * Reloads one event wherever it is shown (its page and the events list) after something changed
 * it: a lifecycle action, or a session added, edited or deleted, since its session count, seats,
 * fill and whether it can be published all come from its sessions.
 */
export function useRefreshEvent(eventId: string): () => void {
  const invalidate = useInvalidate();
  return useCallback(() => {
    void invalidate({ resource: Resource.EVENTS, id: eventId, invalidates: ['detail', 'list'] });
  }, [invalidate, eventId]);
}
