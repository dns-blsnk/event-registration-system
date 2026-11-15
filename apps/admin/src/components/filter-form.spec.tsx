import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SelectFilterField } from './filter-form';

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
