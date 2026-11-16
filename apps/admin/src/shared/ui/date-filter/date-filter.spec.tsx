import { fireEvent, render, screen } from '@testing-library/react';
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
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '05 Dec 2026' } });

    await userEvent.click(screen.getByRole('button', { name: 'Clear Starts from' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      { field: 'startsFrom', operator: 'eq', value: undefined },
    ]);
  });

  it('applies a typed day only when the field is left', () => {
    const onChange = vi.fn();
    render(
      <DateFilter
        name="startsFrom"
        description={STARTS_FROM}
        bound="start"
        filters={[]}
        onChange={onChange}
      />,
    );
    const field = screen.getByLabelText('Starts from');
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '05 Dec 2026' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(field);

    expect(onChange).toHaveBeenCalledWith([
      { field: 'startsFrom', operator: 'eq', value: new Date(2026, 11, 5).toISOString() },
    ]);
  });

  it('applies a day picked in the calendar at once', async () => {
    const onChange = vi.fn();
    render(
      <DateFilter
        name="startsTo"
        description={{ label: 'Starts until', help: '' }}
        bound="end"
        filters={DECEMBER_FIRST.map((filter) => ({ ...filter, field: 'startsTo' }))}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /choose date/i }));
    await userEvent.click(await screen.findByRole('gridcell', { name: '10' }));

    expect(onChange).toHaveBeenCalledWith([
      {
        field: 'startsTo',
        operator: 'eq',
        value: new Date(2026, 11, 10, 23, 59, 59, 999).toISOString(),
      },
    ]);
  });

  it('cannot pick a start day after the end of the range', async () => {
    render(
      <DateFilter
        name="startsFrom"
        description={STARTS_FROM}
        bound="start"
        limit={new Date(2026, 11, 20, 23, 59, 59, 999).toISOString()}
        filters={DECEMBER_FIRST}
        onChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /choose date/i }));

    expect(await screen.findByRole('gridcell', { name: '21' })).toBeDisabled();
    expect(screen.getByRole('gridcell', { name: '20' })).toBeEnabled();
  });

  it('shows the filter cleared elsewhere, and does not bring it back on blur', () => {
    const onChange = vi.fn();
    const props = {
      name: 'startsFrom',
      description: STARTS_FROM,
      bound: 'start' as const,
      onChange,
    };
    const { rerender } = render(<DateFilter {...props} filters={DECEMBER_FIRST} />);

    rerender(<DateFilter {...props} filters={[]} />);
    const field = screen.getByLabelText('Starts from');
    fireEvent.focus(field);
    fireEvent.blur(field);

    expect(field).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not apply a typed start day after the end of the range', () => {
    const onChange = vi.fn();
    render(
      <DateFilter
        name="startsFrom"
        description={STARTS_FROM}
        bound="start"
        limit={new Date(2026, 11, 10, 23, 59, 59, 999).toISOString()}
        filters={[]}
        onChange={onChange}
      />,
    );
    const field = screen.getByLabelText('Starts from');
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '20 Dec 2026' } });

    fireEvent.blur(field);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps keyboard focus in the field after clearing', async () => {
    render(
      <DateFilter
        name="startsFrom"
        description={STARTS_FROM}
        bound="start"
        filters={DECEMBER_FIRST}
        onChange={vi.fn()}
      />,
    );

    screen.getByRole('button', { name: 'Clear Starts from' }).focus();
    await userEvent.keyboard('{Enter}');

    expect(screen.getByLabelText('Starts from')).toHaveFocus();
  });
});
