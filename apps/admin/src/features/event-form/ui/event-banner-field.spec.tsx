import { BANNER_TOO_SMALL_MESSAGE } from '@ers/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickBanner } from '@/test/banner';
import { BANNER_MOCKS } from '@/test/banner-mocks';
import { mockHttp, type MockRoute } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';

import { useEventBanner } from '../model/use-event-banner';

import { EventBannerField } from './event-banner-field';

vi.mock('react-easy-crop', async () => ({ default: (await import('@/test/banner')).FakeCropper }));
vi.mock('../lib/read-image', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  imageSizeOf: (await import('@/test/banner-mocks')).BANNER_MOCKS.imageSizeOf,
}));
vi.mock('../lib/crop-banner', async () => ({
  cropBanner: (await import('@/test/banner-mocks')).BANNER_MOCKS.cropBanner,
}));

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: { user: { id: 'o1', email: 'o@demo.test', name: 'O', role: 'ORGANIZER' }, csrfToken: 't' },
};

function Harness({ currentUrl }: { currentUrl: string | null }): React.JSX.Element {
  const banner = useEventBanner({ hasBanner: currentUrl !== null, isRequired: true });
  return <EventBannerField banner={banner} title="Kyiv Frontend Summit" currentUrl={currentUrl} />;
}

function renderField(currentUrl: string | null = null): void {
  mockHttp([signedIn]);
  renderAdminPage({ path: '/', route: '/', element: <Harness currentUrl={currentUrl} /> });
}

function previewImage(): HTMLElement | null {
  return document.querySelector('img');
}

describe('EventBannerField', () => {
  it('previews the event header with the title before an image is picked', async () => {
    renderField();

    expect(await screen.findByText('Kyiv Frontend Summit')).toBeInTheDocument();
    expect(previewImage()).toBeNull();
    expect(screen.getByText(/Wide 2:1 picture/)).toBeInTheDocument();
  });

  it('shows the framed image in the preview', async () => {
    renderField();

    await pickBanner();

    expect(previewImage()?.getAttribute('src')).toMatch(/^data:image\/jpeg/);
    expect(screen.getByRole('button', { name: 'Replace image' })).toBeInTheDocument();
  });

  it('refuses a file that is not a supported image', async () => {
    renderField();

    await userEvent.upload(
      await screen.findByLabelText('Banner'),
      new File(['%PDF'], 'banner.pdf', { type: 'application/pdf' }),
      { applyAccept: false },
    );

    expect(await screen.findByText('The image must be JPEG, PNG, WebP')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('refuses a file over the size limit', async () => {
    renderField();
    const huge = new File([new Uint8Array(26 * 1024 * 1024)], 'huge.png', { type: 'image/png' });

    await userEvent.upload(await screen.findByLabelText('Banner'), huge);

    expect(await screen.findByText('The image must be at most 25 MB')).toBeInTheDocument();
  });

  it('refuses an image too small for a sharp banner', async () => {
    BANNER_MOCKS.imageSizeOf.mockResolvedValueOnce({ naturalWidth: 1000, naturalHeight: 500 });
    renderField();

    await userEvent.upload(
      await screen.findByLabelText('Banner'),
      new File(['png'], 'small.png', { type: 'image/png' }),
    );

    expect(await screen.findByText(BANNER_TOO_SMALL_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the current banner when framing is cancelled', async () => {
    renderField('https://files.test/current.webp');

    await userEvent.upload(
      await screen.findByLabelText('Banner'),
      new File(['png'], 'b.png', { type: 'image/png' }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(previewImage()).toHaveAttribute('src', 'https://files.test/current.webp');
  });

  it('removes the current banner from the preview', async () => {
    renderField('https://files.test/current.webp');

    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    expect(previewImage()).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose image' })).toBeInTheDocument();
  });
});
