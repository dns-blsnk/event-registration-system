import { Resource } from '@ers/shared';
import { useInvalidate, useNotification } from '@refinedev/core';
import { useState } from 'react';

import { messageOf } from '@/shared/api';

import { saveBanner } from '../api/save-banner';

import { hasBannerAfter, KEEP_BANNER, type BannerDraft } from './banner-draft';

const BANNER_REQUIRED = 'Add a banner: the event page and the catalog open with it';

export interface EventBanner {
  isRequired: boolean;
  draft: BannerDraft;
  setDraft: (draft: BannerDraft) => void;
  /** Why the banner cannot be saved as it is, shown under it. */
  error: string | undefined;
  /** Marks a missing required banner; true when the form may be sent. */
  validate: () => boolean;
  /** Sends the change once the event is saved; false (with a notification) if it failed. */
  save: (eventId: string) => Promise<boolean>;
}

/**
 * The banner part of the event form. It is kept apart from the form values because it is a file
 * sent in its own request after the event itself is saved (a new event has no id before that).
 */
export function useEventBanner({
  hasBanner,
  isRequired,
}: {
  hasBanner: boolean;
  isRequired: boolean;
}): EventBanner {
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const [draft, setDraftState] = useState<BannerDraft>(KEEP_BANNER);
  const [error, setError] = useState<string | undefined>(undefined);
  const setDraft = (next: BannerDraft): void => {
    setDraftState(next);
    setError(undefined);
  };
  const validate = (): boolean => {
    const isMissing = isRequired && !hasBannerAfter(draft, hasBanner);
    setError(isMissing ? BANNER_REQUIRED : undefined);
    return !isMissing;
  };
  const save = async (eventId: string): Promise<boolean> => {
    if (draft.kind === 'keep') return true;
    try {
      await saveBanner(eventId, draft);
    } catch (cause) {
      open?.({
        type: 'error',
        message: 'The event is saved, but its banner is not',
        description: messageOf(cause, 'The banner could not be saved'),
      });
      return false;
    }
    await invalidate({ resource: Resource.EVENTS, invalidates: ['list', 'detail'], id: eventId });
    return true;
  };
  return { isRequired, draft, setDraft, error, validate, save };
}
