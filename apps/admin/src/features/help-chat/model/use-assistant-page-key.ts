import { useState } from 'react';
import { useLocation } from 'react-router';

/** Marks a history entry the assistant opened a list in; its value is new for every opening. */
export const ASSISTANT_LIST_STATE = 'assistantList';

function openingOf(state: unknown): string | undefined {
  if (typeof state !== 'object' || state === null) return undefined;
  const value: unknown = (state as Record<string, unknown>)[ASSISTANT_LIST_STATE];
  return typeof value === 'string' ? value : undefined;
}

/**
 * A key for the page under the layout that changes whenever the router arrives at a list the
 * assistant opened, also by Back and Forward. A list page reads its filters from the URL only when
 * it mounts, so the layout keys the page by this to mount it anew. A navigation the user stopped
 * at the unsaved-changes warning never arrives, so the page and its form stay as they are.
 */
export function useAssistantPageKey(): number {
  const opening = openingOf(useLocation().state);
  const [seen, setSeen] = useState(opening);
  const [key, setKey] = useState(0);
  // Derived during render (no effect): a new opening bumps the key once.
  if (opening !== undefined && opening !== seen) {
    setSeen(opening);
    setKey((current) => current + 1);
  }
  return key;
}
