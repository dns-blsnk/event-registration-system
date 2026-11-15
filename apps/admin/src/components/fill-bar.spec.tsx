import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FillBar, fillLevel } from './fill-bar';

describe('fillLevel', () => {
  it.each([
    [0, 'success'],
    [0.69, 'success'],
    [0.7, 'warning'],
    [0.89, 'warning'],
    [0.895, 'error'],
    [0.9, 'error'],
    [1, 'error'],
  ] as const)('shows %s filled as %s', (rate, level) => {
    expect(fillLevel(rate)).toBe(level);
  });
});

describe('FillBar', () => {
  it('shows the label and the share as an accessible progress bar', () => {
    render(<FillBar rate={0.92} label="4 left" name="Seats left" />);

    const bar = screen.getByRole('progressbar', { name: 'Seats left' });
    expect(bar).toHaveAttribute('aria-valuenow', '92');
    expect(bar).toHaveAttribute('aria-valuetext', '4 left');
    expect(screen.getByText('4 left')).toBeInTheDocument();
  });

  it('never draws past full', () => {
    render(<FillBar rate={1.2} label="Full" name="Seats left" />);

    expect(screen.getByRole('progressbar', { name: 'Seats left' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });
});
