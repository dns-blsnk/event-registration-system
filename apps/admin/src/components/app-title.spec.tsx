import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppTitle } from './app-title';
import { documentTitle } from './brand';

function renderTitle(collapsed: boolean): HTMLElement {
  return render(
    <MemoryRouter>
      <AppTitle collapsed={collapsed} />
    </MemoryRouter>,
  ).container;
}

describe('AppTitle', () => {
  it('is a single link home, never a link inside a link', () => {
    const container = renderTitle(false);

    expect(screen.getByRole('link', { name: 'ERS home' })).toHaveAttribute('href', '/');
    expect(container.querySelectorAll('a a')).toHaveLength(0);
  });

  it('shows the product name next to the mark when the menu is open', () => {
    renderTitle(false);

    expect(screen.getByText('ERS')).toBeInTheDocument();
  });

  it('shows only the mark when the menu is collapsed', () => {
    renderTitle(true);

    expect(screen.queryByText('ERS')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ERS home' })).toBeInTheDocument();
  });
});

describe('documentTitle', () => {
  it('names the product instead of Refine in the browser tab', () => {
    expect(documentTitle('Events | Refine')).toBe('Events | ERS');
    expect(documentTitle('Refine')).toBe('ERS');
  });

  it('leaves the record id out of a show page title', () => {
    expect(documentTitle('#24e73e67-a770-4c84 Show Sessions | Refine')).toBe('Show Sessions | ERS');
  });
});
