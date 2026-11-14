import {
  APP_LOG_CATEGORY_LABELS,
  APP_LOG_FIELDS,
  APP_LOG_LEVEL_LABELS,
  APP_LOG_LIST_CONTROLS,
  AppLogCategory,
  AppLogLevel,
  type AppLogListItem,
} from '@ers/shared';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { List, ShowButton, useDataGrid } from '@refinedev/mui';

import {
  applyFiltersFromFirstPage,
  SearchFilterForm,
  SelectFilterField,
} from '../../components/filter-form';
import { formatDateTime } from '../../components/format';
import { ACTIONS_COLUMN_HEADER } from '../../components/grid';

const LEVELS = Object.values(AppLogLevel);
const CATEGORIES = Object.values(AppLogCategory);

/** Only the time is sortable on the API; the journal is read newest first. */
const columns: GridColDef<AppLogListItem>[] = [
  {
    field: 'createdAt',
    headerName: APP_LOG_FIELDS.createdAt.label,
    minWidth: 170,
    valueFormatter: (value: string) => formatDateTime(value),
  },
  {
    field: 'level',
    headerName: APP_LOG_FIELDS.level.label,
    minWidth: 90,
    sortable: false,
    valueFormatter: (value: AppLogLevel) => APP_LOG_LEVEL_LABELS[value],
  },
  {
    field: 'category',
    headerName: APP_LOG_FIELDS.category.label,
    minWidth: 110,
    sortable: false,
    valueFormatter: (value: AppLogCategory) => APP_LOG_CATEGORY_LABELS[value],
  },
  {
    field: 'statusCode',
    headerName: APP_LOG_FIELDS.statusCode.label,
    type: 'number',
    sortable: false,
  },
  { field: 'method', headerName: APP_LOG_FIELDS.method.label, minWidth: 90, sortable: false },
  // Route alone, as stored and as the search matches it.
  { field: 'route', headerName: APP_LOG_FIELDS.route.label, minWidth: 180, sortable: false },
  {
    field: 'message',
    headerName: APP_LOG_FIELDS.message.label,
    flex: 1,
    minWidth: 240,
    sortable: false,
  },
  {
    field: 'actions',
    headerName: ACTIONS_COLUMN_HEADER,
    sortable: false,
    disableColumnMenu: true,
    minWidth: 90,
    renderCell: ({ row }) => (
      <ShowButton hideText recordItemId={row.id} aria-label={`Open entry ${row.id}`} />
    ),
  },
];

/** The error and security journal for admins, newest first, with request id lookup. */
export function AppLogList(): React.JSX.Element {
  const { dataGridProps, filters, setFilters, setCurrentPage } = useDataGrid<AppLogListItem>({
    sorters: { initial: [{ field: 'createdAt', order: 'desc' }] },
    syncWithLocation: true,
  });
  const onFilters = applyFiltersFromFirstPage({ setCurrentPage, setFilters });
  return (
    <List title="Logs">
      <SearchFilterForm
        textFilters={[
          { name: 'q', description: APP_LOG_LIST_CONTROLS.search },
          { name: 'requestId', description: APP_LOG_FIELDS.requestId },
        ]}
        filters={filters}
        onChange={onFilters}
      >
        <SelectFilterField
          name="category"
          description={APP_LOG_FIELDS.category}
          values={CATEGORIES}
          labels={APP_LOG_CATEGORY_LABELS}
          filters={filters}
          onChange={onFilters}
        />
        <SelectFilterField
          name="level"
          description={APP_LOG_FIELDS.level}
          values={LEVELS}
          labels={APP_LOG_LEVEL_LABELS}
          filters={filters}
          onChange={onFilters}
        />
      </SearchFilterForm>
      <DataGrid {...dataGridProps} columns={columns} disableColumnFilter autoHeight />
    </List>
  );
}
