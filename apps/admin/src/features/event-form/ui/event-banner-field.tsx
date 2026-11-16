import {
  BANNER_MAX_BYTES,
  BANNER_MAX_MEBIBYTES,
  BANNER_MIME_TYPES,
  BANNER_TOO_SMALL_MESSAGE,
  EVENT_FIELDS,
} from '@ers/shared';
import Button from '@mui/material/Button';
import FormHelperText from '@mui/material/FormHelperText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { EventHero } from '@/entities/event';

import { imageSizeOf, toDataUrl } from '../lib/read-image';
import { bannerFileProblem, bannerMaxZoom, hasBannerAfter } from '../model/banner-draft';

import { BannerCropDialog } from './banner-crop-dialog';

import type { EventBanner } from '../model/use-event-banner';

/** Shown on the preview until the title field has text. */
const TITLE_PLACEHOLDER = 'Your event title';

interface Picked {
  src: string;
  maxZoom: number;
}

function previewOf(banner: EventBanner, currentUrl: string | null): string | null {
  switch (banner.draft.kind) {
    case 'keep':
      return currentUrl;
    case 'replace':
      return banner.draft.previewUrl;
    case 'remove':
      return null;
  }
}

/**
 * The banner at the top of the event form: a live preview of the event page's header (the picked
 * image with the current title on it), a button to pick and frame an image, and one to remove it.
 */
export function EventBannerField({
  banner,
  title,
  currentUrl,
  disabled = false,
}: {
  banner: EventBanner;
  title: string;
  currentUrl: string | null;
  disabled?: boolean;
}): React.JSX.Element {
  const [picked, setPicked] = useState<Picked | undefined>(undefined);
  const [pickError, setPickError] = useState<string | undefined>(undefined);
  const willHaveBanner = hasBannerAfter(banner.draft, currentUrl !== null);
  const pick = async (file: File): Promise<void> => {
    const problem = bannerFileProblem(file);
    if (problem !== undefined) {
      setPickError(problem);
      return;
    }
    try {
      const src = await toDataUrl(file);
      const maxZoom = bannerMaxZoom(await imageSizeOf(src));
      setPickError(maxZoom === undefined ? BANNER_TOO_SMALL_MESSAGE : undefined);
      if (maxZoom !== undefined) setPicked({ src, maxZoom });
    } catch (cause) {
      setPickError(cause instanceof Error ? cause.message : 'The image could not be read');
    }
  };
  const use = async (image: Blob): Promise<void> => {
    setPicked(undefined);
    if (image.size > BANNER_MAX_BYTES) {
      setPickError(
        `The framed image is over ${String(BANNER_MAX_MEBIBYTES)} MB: try another photo`,
      );
      return;
    }
    try {
      banner.setDraft({ kind: 'replace', image, previewUrl: await toDataUrl(image) });
    } catch (cause) {
      setPickError(cause instanceof Error ? cause.message : 'The image could not be read');
    }
  };
  const error = pickError ?? banner.error;
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" component="h2">
        {EVENT_FIELDS.banner.label}
        {banner.isRequired && ' *'}
      </Typography>
      <EventHero
        title={title.trim() === '' ? TITLE_PLACEHOLDER : title}
        bannerUrl={previewOf(banner, currentUrl)}
      />
      <Stack direction="row" spacing={1}>
        <Button component="label" variant="outlined" disabled={disabled}>
          {willHaveBanner ? 'Replace image' : 'Choose image'}
          <input
            hidden
            type="file"
            accept={BANNER_MIME_TYPES.join(',')}
            disabled={disabled}
            aria-label={EVENT_FIELDS.banner.label}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file !== undefined) void pick(file);
            }}
          />
        </Button>
        {willHaveBanner && (
          <Button
            color="error"
            disabled={disabled}
            onClick={() => {
              setPickError(undefined);
              banner.setDraft(currentUrl === null ? { kind: 'keep' } : { kind: 'remove' });
            }}
          >
            Remove
          </Button>
        )}
      </Stack>
      <FormHelperText error={error !== undefined}>
        {error ?? EVENT_FIELDS.banner.help}
      </FormHelperText>
      {picked !== undefined && (
        <BannerCropDialog
          src={picked.src}
          maxZoom={picked.maxZoom}
          onCancel={() => {
            setPicked(undefined);
          }}
          onCropped={(image) => void use(image)}
        />
      )}
    </Stack>
  );
}
