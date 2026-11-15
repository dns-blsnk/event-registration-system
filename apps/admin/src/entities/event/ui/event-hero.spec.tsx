import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EventHero } from './event-hero';

describe('EventHero', () => {
  it('writes the title on the banner as the page heading', () => {
    render(<EventHero title="Kyiv Frontend Summit" bannerUrl="https://files.test/b.png" />);

    expect(screen.getByRole('heading', { name: 'Kyiv Frontend Summit' })).toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('falls back to the brand gradient when the banner cannot be loaded', () => {
    render(<EventHero title="Kyiv Frontend Summit" bannerUrl="https://files.test/gone.png" />);
    const banner = document.querySelector('img');
    if (banner === null) throw new Error('expected the banner image');

    fireEvent.error(banner);

    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Kyiv Frontend Summit' })).toBeInTheDocument();
  });
});
