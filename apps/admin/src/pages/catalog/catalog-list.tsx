import {
  EVENT_FIELDS,
  EVENT_LIST_CONTROLS,
  SESSION_FIELDS,
  type CatalogEventListItem,
} from '@ers/shared';
import Stack from '@mui/material/Stack';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { List, ShowButton, useDataGrid } from '@refinedev/mui';

import {
  ApplySearchButton,
  applyFiltersFromFirstPage,
  submitTextFilters,
  TextFilterField,
} from '../../components/filter-form';
import { formatDateTime } from '../../components/format';
import { ACTIONS_COLUMN_HEADER } from '../../components/grid';

/** Seats left only means something when a session can still be booked. */
function seatsText(event: CatalogEventListItem): string {
  if (event.upcomingSessionsCount === 0) return 'Nothing left to book';
  return event.seatsLeft === 0 ? 'Waitlist only' : String(event.seatsLeft);
}

const columns: GridColDef<CatalogEventListItem>[] = [
  { field: 'title', headerName: EVENT_FIELDS.title.label, flex: 2, minWidth: 200 },
  { field: 'city', headerName: EVENT_FIELDS.city.label, flex: 1, minWidth: 120, sortable: false },
  {
    field: 'startsAt',
    headerName: EVENT_FIELDS.startsAt.label,
    minWidth: 170,
    valueFormatter: (value: string) => formatDateTime(value),
  },
  {
    field: 'tags',
    headerName: EVENT_FIELDS.tags.label,
    flex: 1,
    minWidth: 140,
    sortable: false,
    valueGetter: (_value, row) => row.tags.map((tag) => tag.name).join(', '),
  },
  {
    field: 'seatsLeft',
    headerName: SESSION_FIELDS.seatsLeft.label,
    minWidth: 150,
    sortable: false,
    valueGetter: (_value, row) => seatsText(row),
  },
  {
    field: 'actions',
    headerName: ACTIONS_COLUMN_HEADER,
    sortable: false,
    disableColumnMenu: true,
    minWidth: 90,
    renderCell: ({ row }) => (
      <ShowButton hideText recordItemId={row.id} aria-label={`Open ${row.title}`} />
    ),
  },
];

/** Published events a customer can still attend, soonest first. */
export function CatalogList(): React.JSX.Element {
  const { dataGridProps, filters, setFilters, setCurrentPage } = useDataGrid<CatalogEventListItem>({
    sorters: { initial: [{ field: 'startsAt', order: 'asc' }] },
    syncWithLocation: true,
  });
  const onFilters = applyFiltersFromFirstPage({ setCurrentPage, setFilters });
  return (
    <List title="Catalog">
      <Stack
        component="form"
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 2 }}
        alignItems={{ sm: 'flex-start' }}
        onSubmit={submitTextFilters(['q', 'city'], onFilters)}
      >
        <TextFilterField name="q" description={EVENT_LIST_CONTROLS.search} filters={filters} />
        <TextFilterField name="city" description={EVENT_FIELDS.city} filters={filters} />
        <ApplySearchButton />
      </Stack>
      <DataGrid {...dataGridProps} columns={columns} disableColumnFilter autoHeight />
    </List>
  );
}
