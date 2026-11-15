import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DateFilter } from './date-filter';

const STARTS_FROM = { label: 'Starts from', help: '' };
const DECEMBER_FIRST = [
  { field: 'startsFrom', operator: 'eq' as const, value: '2026-12-01T00:00:00.000Z' },
];

describe('DateFilter', () => {
  it('clears its day with one click', async () => {
    const onChange = vi.fn();
    render(
      <DateFilter
        name="startsFrom"
        description={STARTS_FROM}
        bound="start"
        filters={DECEMBER_FIRST}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear Starts from' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      { field: 'startsFrom', operator: 'eq', value: undefined },
    ]);
  });

  it('clears instead of applying a day typed but not yet left', async () => {
    const onChange = vi.fn();
    render(
      <DateFilter
        name="startsFrom"
        description={STARTS_FROM}
        bound="start"
        filters={DECEMBER_FIRST}
        onChange={onChange}
      />,
    );
    const field = screen.getByLabelText('Starts from');
    await userEvent.click(field);
    await userEvent.clear(field);
    await userEvent.type(field, '2026-12-05');

    await userEvent.click(screen.getByRole('button', { name: 'Clear Starts from' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      { field: 'startsFrom', operator: 'eq', value: undefined },
    ]);
  });
});
