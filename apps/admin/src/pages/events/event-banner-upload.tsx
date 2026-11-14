import {
  BANNER_MAX_BYTES,
  BANNER_MAX_MEBIBYTES,
  BANNER_MIME_TYPES,
  BANNER_TYPE_LABELS,
  Resource,
} from '@ers/shared';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useInvalidate, useNotification } from '@refinedev/core';
import { useState } from 'react';

import { messageOf } from '../../api/errors';
import { http } from '../../api/http';

const TYPE_NAMES = Object.values(BANNER_TYPE_LABELS).join(', ');

function isBannerType(type: string): boolean {
  return (BANNER_MIME_TYPES as readonly string[]).includes(type);
}

/**
 * Banner upload and removal. The browser pre-checks size and declared type for a quick answer; the API
 * checks the real type from the file's bytes and the size again before storing anything.
 */
export function EventBannerUpload({
  eventId,
  hasBanner: initialHasBanner,
}: {
  eventId: string;
  hasBanner: boolean;
}): React.JSX.Element {
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const [isBusy, setBusy] = useState(false);
  // Kept here instead of refetching the event: a refetch would overwrite unsaved form edits.
  const [hasBanner, setHasBanner] = useState(initialHasBanner);
  const run = async (
    request: () => Promise<unknown>,
    done: string,
    nextHasBanner: boolean,
  ): Promise<void> => {
    setBusy(true);
    try {
      await request();
      setHasBanner(nextHasBanner);
      open?.({ type: 'success', message: done });
      await invalidate({ resource: Resource.EVENTS, invalidates: ['list'] });
    } catch (error) {
      open?.({ type: 'error', message: messageOf(error, 'The banner could not be saved') });
    } finally {
      setBusy(false);
    }
  };
  const upload = (file: File): void => {
    if (!isBannerType(file.type)) {
      open?.({ type: 'error', message: `The image must be ${TYPE_NAMES}` });
      return;
    }
    if (file.size > BANNER_MAX_BYTES) {
      open?.({
        type: 'error',
        message: `The image must be at most ${String(BANNER_MAX_MEBIBYTES)} MB`,
      });
      return;
    }
    const body = new FormData();
    body.append('file', file);
    void run(() => http.put(`/events/${eventId}/banner`, body), 'Banner saved', true);
  };
  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <Button component="label" variant="outlined" disabled={isBusy}>
        {hasBanner ? 'Replace banner' : 'Upload banner'}
        <input
          hidden
          type="file"
          accept={BANNER_MIME_TYPES.join(',')}
          aria-label="Banner image"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file !== undefined) {
              upload(file);
            }
          }}
        />
      </Button>
      {hasBanner && (
        <Button
          color="error"
          disabled={isBusy}
          onClick={() =>
            void run(() => http.delete(`/events/${eventId}/banner`), 'Banner removed', false)
          }
        >
          Remove banner
        </Button>
      )}
      <Typography variant="body2" color="text.secondary">
        {TYPE_NAMES}, up to {BANNER_MAX_MEBIBYTES} MB
      </Typography>
    </Stack>
  );
}
