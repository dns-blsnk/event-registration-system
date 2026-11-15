import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SEARCH_DEBOUNCE_MS } from '../search-field/search-field';

import { SearchFilterForm, SelectFilterField } from './filter-form';

import type { CrudFilters } from '@refinedev/core';

const STATUSES = ['DRAFT', 'PUBLISHED'] as const;
const LABELS = { DRAFT: 'Draft', PUBLISHED: 'Published' };

describe('SelectFilterField', () => {
  it('names its field and keeps the label off the select box, so the browser flags no orphan label', () => {
    const { container } = render(
      <SelectFilterField
        name="status"
        description={{ label: 'Status', help: '' }}
        values={STATUSES}
        labels={LABELS}
        filters={[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
    expect(container.querySelector('input[name="status"]')).not.toBeNull();
    expect(screen.getByText('Status', { selector: 'label' })).not.toHaveAttribute('for');
  });
});

describe('SearchFilterForm', () => {
  const SEARCH = { name: 'q', description: { label: 'Search', help: '' } };

  it('offers no "Clear filters" while nothing is filtered', () => {
    render(<SearchFilterForm textFilters={[SEARCH]} filters={[]} onChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('clears every filter of the form at once, but not one the page fixes itself', async () => {
    const onChange = vi.fn();
    const filters: CrudFilters = [
      { field: 'q', operator: 'eq', value: 'react' },
      { field: 'status', operator: 'eq', value: 'CONFIRMED' },
      { field: 'sessionId', operator: 'eq', value: 's1' },
    ];
    render(
      <SearchFilterForm
        textFilters={[SEARCH]}
        otherFields={['status']}
        filters={filters}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(onChange).toHaveBeenCalledWith([
      { field: 'q', operator: 'eq', value: undefined },
      { field: 'status', operator: 'eq', value: undefined },
    ]);
  });

  it('drops a search still waiting to apply when the filters are cleared', async () => {
    const onChange = vi.fn();
    render(
      <SearchFilterForm
        textFilters={[SEARCH]}
        otherFields={['status']}
        filters={[{ field: 'status', operator: 'eq', value: 'CONFIRMED' }]}
        onChange={onChange}
      />,
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'rea');

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS * 2));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('');
  });
});
