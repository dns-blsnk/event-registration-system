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

  it('leaves out the detail line without a detail, instead of an empty one under the value', () => {
    const { container } = render(<FactCard icon={null} label="Organizer" value="Olena" />);

    expect(container.querySelectorAll('p, h6, span.MuiTypography-root')).toHaveLength(2);
  });
});
