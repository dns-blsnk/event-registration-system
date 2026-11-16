import { BANNER_FILE_FIELD, Resource } from '@ers/shared';

import { http } from '@/shared/api';

import type { BannerDraft } from '../model/banner-draft';

/** Sends a banner change for a saved event; keeping the banner sends nothing. */
export async function saveBanner(eventId: string, draft: BannerDraft): Promise<void> {
  const path = `/${Resource.EVENTS}/${eventId}/banner`;
  switch (draft.kind) {
    case 'keep':
      return;
    case 'replace': {
      const body = new FormData();
      body.append(BANNER_FILE_FIELD, draft.image, 'banner.jpg');
      await http.put(path, body);
      return;
    }
    case 'remove':
      await http.delete(path);
      return;
  }
}
