import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef } from 'react';
import { expect } from 'vitest';

import type { CropperProps } from 'react-easy-crop';

/** A file the banner field accepts; the browser-only parts (size, crop) are mocked by the specs. */
export const BANNER_FILE = new File(['jpeg'], 'banner.jpg', { type: 'image/jpeg' });

/** The real cropper needs a laid-out image; this one reports a framed area as soon as it mounts. */
export function FakeCropper({ onCropComplete }: Partial<CropperProps>): null {
  const hasReported = useRef(false);
  useEffect(() => {
    if (hasReported.current) return;
    hasReported.current = true;
    onCropComplete?.(
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 0, y: 0, width: 2400, height: 1200 },
    );
  }, [onCropComplete]);
  return null;
}

/** Picks a banner and accepts the framing, as a person would; returns once the dialog is gone. */
export async function pickBanner(file: File = BANNER_FILE): Promise<void> {
  await userEvent.upload(screen.getByLabelText('Banner'), file);
  await userEvent.click(await screen.findByRole('button', { name: 'Use this image' }));
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
}
