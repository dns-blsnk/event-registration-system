import TextField from '@mui/material/TextField';
import dayjs from 'dayjs';

import { filterText } from './filter-form';

import type { FieldDescription } from '@ers/shared';
import type { CrudFilters } from '@refinedev/core';

const INPUT_DAY = 'YYYY-MM-DD';
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Start of a range takes the day's first moment, its end the day's last, both in local time. */
export type DayBound = 'start' | 'end';

interface DateFilterProps {
  name: string;
  description: FieldDescription;
  bound: DayBound;
  filters: CrudFilters;
  onChange: (filters: CrudFilters) => void;
  /** The other end of the range (an ISO instant), so the picker cannot build a reversed range. */
  limit?: string;
}

/** The ISO instant a picked day stands for, in the viewer's time zone, as the list shows times. */
export function dayToInstant(day: string, bound: DayBound): string {
  // dayjs reads a date-only string as local midnight.
  const local = dayjs(day);
  return (bound === 'start' ? local.startOf('day') : local.endOf('day')).toISOString();
}

function isDay(value: string): boolean {
  return DAY_PATTERN.test(value) && dayjs(value).isValid();
}

function instantToDay(instant: string): string {
  return instant === '' ? '' : dayjs(instant).format(INPUT_DAY);
}

/**
 * A day filter. It applies when the field loses focus, not on every keystroke, since typing a
 * year passes through partial values. Days are the viewer's local days, sent as exact instants.
 */
export function DateFilter({
  name,
  description,
  bound,
  filters,
  onChange,
  limit,
}: DateFilterProps): React.JSX.Element {
  const day = instantToDay(filterText(name, filters));
  const limitDay = limit === undefined || limit === '' ? undefined : instantToDay(limit);
  return (
    <TextField
      // Keyed by the active value, so the field follows filters changed elsewhere (Back, clearing).
      key={`${name}:${day}`}
      type="date"
      label={description.label}
      helperText={description.help}
      defaultValue={day}
      onBlur={(event) => {
        const picked = event.target.value;
        if (picked === day || (picked !== '' && !isDay(picked))) return;
        onChange([
          {
            field: name,
            operator: 'eq',
            value: picked === '' ? undefined : dayToInstant(picked, bound),
          },
        ]);
      }}
      size="small"
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: bound === 'start' ? { max: limitDay } : { min: limitDay },
      }}
    />
  );
}
