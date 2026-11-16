import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  DataGrid,
  type DataGridProps,
  type GridColDef,
  type GridValidRowModel,
} from '@mui/x-data-grid';
import { useDataGrid } from '@refinedev/mui';
import { useCallback, useMemo } from 'react';

import {
  headerMinWidth,
  rememberWidth,
  savedWidthsOf,
  tableKeyOf,
  withSavedWidth,
} from '../column-widths/column-widths';
import { PageFill } from '../page-fill/page-fill';

import type { SxProps, Theme } from '@mui/material/styles';
import type { BaseRecord, HttpError } from '@refinedev/core';

type UseDataGridProps<TData extends BaseRecord> = Parameters<
  typeof useDataGrid<TData, HttpError>
>[0];

const GRID_FILTER_MODEL_KEYS: ReadonlySet<string> = new Set(['filterModel', 'onFilterModelChange']);

type DataGridResult<TData extends BaseRecord> = ReturnType<typeof useDataGrid<TData, HttpError>>;
type ListGridDataProps<TData extends BaseRecord> = Omit<
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
): Omit<DataGridResult<TData>, 'dataGridProps'> & { dataGridProps: ListGridDataProps<TData> } {
  const result = useDataGrid<TData>(props);
  const gridProps = Object.fromEntries(
    Object.entries(result.dataGridProps).filter(([key]) => !GRID_FILTER_MODEL_KEYS.has(key)),
  ) as ListGridDataProps<TData>;
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

/**
 * Shared column rules: the first column names the row, so it can never be hidden and leave a
 * table of bare buttons; no column is narrower than its title and header buttons; a width the
 * user set earlier comes back.
 */
export function normalizeColumns<R extends GridValidRowModel>(
  columns: readonly GridColDef<R>[],
  savedWidths: ReadonlyMap<string, number> = new Map(),
): GridColDef<R>[] {
  return columns.map((column, index) =>
    withSavedWidth(
      {
        ...column,
        ...(index === 0 ? { hideable: false } : {}),
        minWidth: Math.max(column.minWidth ?? 0, headerMinWidth(column)),
      },
      savedWidths.get(column.field),
    ),
  );
}

// The browser flags form fields with neither a name nor an id; the page size picker gets a name.
const PAGINATION_PROPS = { material: { slotProps: { select: { name: 'pageSize' } } } };

type ListGridProps<R extends GridValidRowModel> = Omit<
  DataGridProps<R>,
  'sx' | 'autoHeight' | 'disableColumnFilter'
> & {
  /** A list page's table fills the window and scrolls its rows; one inside another page grows. */
  fillsWindow?: boolean;
};

/**
 * The data table every list uses: server paging and sorting from Refine, filters in the page's own
 * form. With no rows there is nothing to page or sort, so those controls switch off.
 */
export function ListGrid<R extends GridValidRowModel>({
  fillsWindow = false,
  // Look and filtering are the same for every list, so callers cannot set them; height is fillsWindow.
  ...props
}: ListGridProps<R>): React.JSX.Element {
  const { columns, slots, slotProps, onColumnWidthChange, ...rest } = props;
  const table = tableKeyOf(columns, fillsWindow);
  const visibleColumns = useMemo(
    () => normalizeColumns(columns, savedWidthsOf(table)),
    [columns, table],
  );
  const handleColumnWidthChange = useCallback<NonNullable<typeof onColumnWidthChange>>(
    (params, event, details) => {
      rememberWidth(table, params.colDef.field, params.width);
      onColumnWidthChange?.(params, event, details);
    },
    [table, onColumnWidthChange],
  );
  const isEmpty = rest.rowCount === 0 && rest.loading !== true;
  const grid = (
    <DataGrid
      {...rest}
      columns={visibleColumns}
      disableColumnFilter
      autoHeight={!fillsWindow}
      onColumnWidthChange={handleColumnWidthChange}
      hideFooter={isEmpty}
      disableColumnSorting={isEmpty}
      slots={{ noRowsOverlay: NoRowsOverlay, ...slots }}
      slotProps={{
        ...slotProps,
        basePagination: { ...slotProps?.basePagination, ...PAGINATION_PROPS },
      }}
      sx={GRID_SX}
    />
  );
  return fillsWindow ? <PageFill>{grid}</PageFill> : grid;
}
