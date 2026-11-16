import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import dayjs, { type Dayjs } from 'dayjs';
import { useRef, useState } from 'react';

import { FILTER_FIELD_SX } from '@/shared/lib/forms';

import { filterText } from '../filter-form/filter-form';

import type { FieldDescription } from '@ers/shared';
import type { CrudFilters } from '@refinedev/core';

const INPUT_DAY = 'YYYY-MM-DD';
/** The same day format the lists show, whatever the browser's locale. */
const SHOWN_DAY = 'DD MMM YYYY';

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

function instantToDay(instant: string): string {
  return instant === '' ? '' : dayjs(instant).format(INPUT_DAY);
}

interface DayLimits {
  minDate?: Dayjs;
  maxDate?: Dayjs;
}

function limitsOf(limit: string | undefined, bound: DayBound): DayLimits {
  if (limit === undefined || limit === '') return {};
  const limitDay = dayjs(limit);
  return bound === 'start' ? { maxDate: limitDay } : { minDate: limitDay };
}

/** A typed day past the other end of the range; the calendar does not offer those at all. */
function isOutOfRange(value: Dayjs, { minDate, maxDate }: DayLimits): boolean {
  return (
    (minDate !== undefined && value.isBefore(minDate, 'day')) ||
    (maxDate !== undefined && value.isAfter(maxDate, 'day'))
  );
}

function pickedOf(day: string): Dayjs | null {
  return day === '' ? null : dayjs(day);
}

/**
 * A day filter. A day picked in the calendar applies at once; a typed one when the field loses
 * focus, not on every keystroke, since typing passes through half-filled dates. Days are the
 * viewer's local days, sent as exact instants.
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
  const limits = limitsOf(limit, bound);
  const [picked, setPicked] = useState(pickedOf(day));
  const [followedDay, setFollowedDay] = useState(day);
  const inputRef = useRef<HTMLInputElement>(null);
  // The filter changed elsewhere (Back, "Clear filters"): show it. Set during render, so there is
  // no paint with the old day, and the field is not remounted (an open calendar stays open).
  if (day !== followedDay) {
    setFollowedDay(day);
    setPicked(pickedOf(day));
  }
  /** Applies a day, or removes the filter for none; a half-typed, out-of-range or active day is skipped. */
  const apply = (value: Dayjs | null): void => {
    if (value !== null && (!value.isValid() || isOutOfRange(value, limits))) return;
    const next = value === null ? '' : value.format(INPUT_DAY);
    if (next === day) return;
    onChange([
      { field: name, operator: 'eq', value: next === '' ? undefined : dayToInstant(next, bound) },
    ]);
  };
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DatePicker
        // Named like the filter, so the help chat can tell which day field is in focus. The plain
        // input structure keeps one real <input> carrying that name.
        name={name}
        enableAccessibleFieldDOMStructure={false}
        inputRef={inputRef}
        label={description.label}
        format={SHOWN_DAY}
        value={picked}
        onChange={setPicked}
        onAccept={(value, context) => {
          // The field "accepts" every complete date typed, even year 0002 on the way to 2026;
          // only a day picked in the calendar applies here, typed ones wait for blur.
          if (context.source === 'view') apply(value);
        }}
        {...limits}
        slotProps={{
          field: {
            // Only a set day can be cleared; an empty field keeps just the calendar button.
            clearable: day !== '',
            onClear: () => {
              apply(null);
              // The button hides with the day; keyboard focus stays in the field.
              inputRef.current?.focus();
            },
          },
          clearButton: {
            'aria-label': `Clear ${description.label}`,
            // Pressing it must not blur the field first: a typed day applies on blur.
            onMouseDown: (event) => {
              event.preventDefault();
            },
          },
          textField: {
            size: 'small',
            sx: FILTER_FIELD_SX,
            helperText: description.help,
            onBlur: () => {
              apply(picked);
            },
          },
        }}
      />
    </LocalizationProvider>
  );
}
