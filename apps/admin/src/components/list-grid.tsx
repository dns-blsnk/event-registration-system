import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  DataGrid,
  type DataGridProps,
  type GridColDef,
  type GridValidRowModel,
} from '@mui/x-data-grid';
import { useDataGrid } from '@refinedev/mui';
import { useMemo } from 'react';

import type { SxProps, Theme } from '@mui/material/styles';
import type { BaseRecord, HttpError } from '@refinedev/core';

type UseDataGridProps<TData extends BaseRecord> = Parameters<
  typeof useDataGrid<TData, HttpError>
>[0];

const GRID_FILTER_MODEL_KEYS: ReadonlySet<string> = new Set(['filterModel', 'onFilterModelChange']);

type DataGridResult<TData extends BaseRecord> = ReturnType<typeof useDataGrid<TData, HttpError>>;
type ListGridProps<TData extends BaseRecord> = Omit<
  DataGridResult<TData>['dataGridProps'],
  'filterModel' | 'onFilterModelChange'
>;

/**
 * Refine's useDataGrid, with two fixes for lists whose filters live in their own form:
 * - the row count of an empty result: Refine keeps the last non-zero total, so a search with no
 *   matches still read "1–25 of 1500";
 * - no filter model for the grid: filter fields such as `q` are not columns, so the grid dropped
 *   them on render (a state update mid-render) and the next page lost the search.
 */
export function useListGrid<TData extends BaseRecord>(
  props: UseDataGridProps<TData>,
): Omit<DataGridResult<TData>, 'dataGridProps'> & { dataGridProps: ListGridProps<TData> } {
  const result = useDataGrid<TData>(props);
  const gridProps = Object.fromEntries(
    Object.entries(result.dataGridProps).filter(([key]) => !GRID_FILTER_MODEL_KEYS.has(key)),
  ) as ListGridProps<TData>;
  const total = result.tableQuery.data?.total;
  return { ...result, dataGridProps: { ...gridProps, rowCount: total ?? gridProps.rowCount } };
}

const GRID_SX: SxProps<Theme> = {
  // A click focuses a cell without doing anything; keep the ring for keyboard focus only.
  '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': { outline: 'none' },
  '& .MuiDataGrid-cell:focus-visible, & .MuiDataGrid-columnHeader:focus-visible': {
    outline: (theme) => `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '-2px',
  },
  // Header buttons keep their space and only fade in, so titles do not shift or truncate on hover.
  '& .MuiDataGrid-menuIcon, & .MuiDataGrid-iconButtonContainer': {
    width: 'auto',
    visibility: 'hidden',
  },
  '& .MuiDataGrid-columnHeader:hover .MuiDataGrid-menuIcon, & .MuiDataGrid-menuOpen, & .MuiDataGrid-columnHeader:hover .MuiDataGrid-iconButtonContainer, & .MuiDataGrid-columnHeader--sorted .MuiDataGrid-iconButtonContainer':
    { visibility: 'visible' },
};

function NoRowsOverlay(): React.JSX.Element {
  return (
    <Stack sx={{ height: '100%', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Typography>Nothing found.</Typography>
      <Typography variant="body2" color="text.secondary">
        Try another search or clear the filters.
      </Typography>
    </Stack>
  );
}

/** Room for a short title such as "Seats left" plus the sort and menu buttons it keeps. */
const NUMBER_COLUMN_MIN_WIDTH = 130;

/**
 * Shared column rules: the first column names the row, so it can never be hidden and leave a
 * table of bare buttons; number columns get room for their title and header buttons.
 */
export function normalizeColumns<R extends GridValidRowModel>(
  columns: readonly GridColDef<R>[],
): GridColDef<R>[] {
  return columns.map((column, index) => ({
    ...column,
    ...(index === 0 ? { hideable: false } : {}),
    ...(column.type === 'number' && column.minWidth === undefined
      ? { minWidth: NUMBER_COLUMN_MIN_WIDTH }
      : {}),
  }));
}

/**
 * The data table every list uses: server paging and sorting from Refine, filters in the page's own
 * form. With no rows there is nothing to page or sort, so those controls switch off.
 */
export function ListGrid<R extends GridValidRowModel>(
  // Look, height and filtering are the same for every list, so callers cannot set them.
  props: Omit<DataGridProps<R>, 'sx' | 'autoHeight' | 'disableColumnFilter'>,
): React.JSX.Element {
  const { columns, slots, ...rest } = props;
  const visibleColumns = useMemo(() => normalizeColumns(columns), [columns]);
  const isEmpty = rest.rowCount === 0 && rest.loading !== true;
  return (
    <DataGrid
      {...rest}
      columns={visibleColumns}
      disableColumnFilter
      autoHeight
      hideFooter={isEmpty}
      disableColumnSorting={isEmpty}
      slots={{ noRowsOverlay: NoRowsOverlay, ...slots }}
      sx={GRID_SX}
    />
  );
}
