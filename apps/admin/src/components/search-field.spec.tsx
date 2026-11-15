import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SEARCH_DEBOUNCE_MS, SearchField } from './search-field';

const DESCRIPTION = { label: 'Search', help: 'Matches the title.' };

function renderField(value = ''): { onApply: ReturnType<typeof vi.fn> } {
  const onApply = vi.fn();
  render(<SearchField name="q" description={DESCRIPTION} value={value} onApply={onApply} />);
  return { onApply };
}

/** A list page in miniature: the applied filter flows back into the field, as Refine does. */
function LiveSearch({
  onApply,
}: {
  onApply: (value: string | undefined) => void;
}): React.JSX.Element {
  const [value, setValue] = useState('');
  return (
    <SearchField
      name="q"
      description={DESCRIPTION}
      value={value}
      onApply={(next) => {
        onApply(next);
        setValue(next ?? '');
      }}
    />
  );
}

function pause(): Promise<void> {
  return act(() => new Promise<void>((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 50)));
}

describe('SearchField', () => {
  it('searches once typing pauses, with the whole trimmed text', async () => {
    const { onApply } = renderField();

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), ' react ');

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith('react');
    });
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('searches at once on Enter', async () => {
    const { onApply } = renderField();

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'vue{Enter}');

    expect(onApply).toHaveBeenCalledWith('vue');
  });

  it('clears the box and the filter with one click', async () => {
    const { onApply } = renderField('react');

    await userEvent.click(screen.getByRole('button', { name: 'Clear Search' }));

    expect(onApply).toHaveBeenCalledWith(undefined);
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear Search' })).not.toBeInTheDocument();
  });

  it('keeps room for the clear button while empty, so the box does not change width', () => {
    renderField();

    // Laid out but invisible, so screen readers and the tab order skip it too.
    const clear = document.querySelector('button[aria-label="Clear Search"]');
    expect(clear).not.toBeNull();
    expect(clear).not.toBeVisible();
  });

  it('removes the filter when the text is deleted', async () => {
    const { onApply } = renderField('react');

    await userEvent.clear(screen.getByRole('textbox', { name: 'Search' }));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith(undefined);
    });
  });

  it('shows a filter changed elsewhere, such as by Back', () => {
    const onApply = vi.fn();
    const { rerender } = render(
      <SearchField name="q" description={DESCRIPTION} value="react" onApply={onApply} />,
    );

    rerender(<SearchField name="q" description={DESCRIPTION} value="vue" onApply={onApply} />);

    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('vue');
  });

  it('keeps a space typed before the next word while the first word is applied', async () => {
    const onApply = vi.fn();
    render(<LiveSearch onApply={onApply} />);
    const box = screen.getByRole('textbox', { name: 'Search' });

    await userEvent.type(box, 'new ');
    await pause();
    await userEvent.type(box, 'york');
    await pause();

    expect(box).toHaveValue('new york');
    expect(onApply).toHaveBeenLastCalledWith('new york');
  });

  it('lets a filter changed elsewhere win over typing still waiting to apply', async () => {
    const onApply = vi.fn();
    const { rerender } = render(
      <SearchField name="q" description={DESCRIPTION} value="" onApply={onApply} />,
    );

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'abc');
    rerender(<SearchField name="q" description={DESCRIPTION} value="vue" onApply={onApply} />);
    await pause();

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('vue');
  });

  it('does not re-apply the search already in force, so paging is kept', async () => {
    const { onApply } = renderField('react');

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), ' {Enter}');
    await pause();

    expect(onApply).not.toHaveBeenCalled();
  });

  it('keeps keyboard focus in the box after clearing it', async () => {
    renderField('react');

    await userEvent.click(screen.getByRole('button', { name: 'Clear Search' }));

    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus();
  });
});
