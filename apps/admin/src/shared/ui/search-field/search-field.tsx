import TextField from '@mui/material/TextField';
import { useRef, useState } from 'react';

import { useDebouncedCallback } from '@/shared/lib/use-debounced-callback';

import { ClearAdornment } from '../clear-adornment/clear-adornment';

import type { FieldDescription } from '@ers/shared';

/** Long enough to skip the keystrokes of a word typed at an unhurried pace, short enough to feel prompt. */
export const SEARCH_DEBOUNCE_MS = 500;

/** A trimmed value; empty means "remove this filter". */
function filterValue(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * A free-text filter that searches as you type (after a short pause), at once on Enter, and
 * clears with one click. It follows its filter when that changes elsewhere (Back, a reset).
 */
export function SearchField({
  name,
  description,
  value,
  onApply,
}: {
  name: string;
  description: FieldDescription;
  /** The filter's active value, '' when unset. */
  value: string;
  onApply: (value: string | undefined) => void;
}): React.JSX.Element {
  const [text, setText] = useState(value);
  const [followed, setFollowed] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // The filter changed. Show it, unless it is just this box's own text applied (trimmed), so a
  // space typed before the next word survives. Set during render: no paint with stale text.
  if (value !== followed) {
    setFollowed(value);
    if (value !== (filterValue(text) ?? '')) setText(value);
  }
  /** Applies a text, unless it is the filter already in force (which would also reset paging). */
  const apply = (next: string, current: string): void => {
    if (filterValue(next) !== filterValue(current)) onApply(filterValue(next));
  };
  const debounced = useDebouncedCallback((next: string, scheduledOver: string) => {
    // The filter changed elsewhere while typing paused (Back, a reset): that change wins.
    if (scheduledOver === value) apply(next, value);
  }, SEARCH_DEBOUNCE_MS);
  const applyNow = (next: string): void => {
    debounced.cancel();
    apply(next, value);
  };
  return (
    <TextField
      name={name}
      label={description.label}
      helperText={description.help}
      value={text}
      size="small"
      inputRef={inputRef}
      onChange={(event) => {
        setText(event.target.value);
        debounced.schedule(event.target.value, value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyNow(text);
        }
      }}
      slotProps={{
        input: {
          endAdornment: (
            <ClearAdornment
              label={description.label}
              isHidden={text === ''}
              onClear={() => {
                setText('');
                applyNow('');
                // The button hides with the text; keyboard focus stays in the box.
                inputRef.current?.focus();
              }}
            />
          ),
        },
      }}
    />
  );
}
