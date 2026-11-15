import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FactCard } from './fact-card';

describe('FactCard', () => {
  it('shows the label, the value and its detail', () => {
    render(<FactCard icon={null} label="Where" value="Kyiv" detail="Main Hall" />);

    expect(screen.getByText('Where')).toBeInTheDocument();
    expect(screen.getByText('Kyiv')).toBeInTheDocument();
    expect(screen.getByText('Main Hall')).toBeInTheDocument();
  });

  it('keeps the detail line without a detail, so cards in a row stay the same height', () => {
    const { container } = render(<FactCard icon={null} label="Organizer" value="Olena" />);

    expect(container.querySelectorAll('p, h6, span.MuiTypography-root')).toHaveLength(3);
  });
});
