import {
  EVENT_FIELDS,
  EVENT_LIST_CONTROLS,
  SESSION_FIELDS,
  type CatalogEventListItem,
} from '@ers/shared';
import { type GridColDef } from '@mui/x-data-grid';
import { List, ShowButton } from '@refinedev/mui';

import { formatDateTime } from '@/shared/lib/format';
import { ACTIONS_COLUMN_HEADER } from '@/shared/lib/grid';
import { applyFiltersFromFirstPage, SearchFilterForm } from '@/shared/ui/filter-form';
import { ListGrid, useListGrid } from '@/shared/ui/list-grid';
import { FILL_LIST_PROPS } from '@/shared/ui/page-fill';
import { RowLink } from '@/shared/ui/row-link';

/** Seats left only means something when a session can still be booked. */
function seatsText(event: CatalogEventListItem): string {
  if (event.upcomingSessionsCount === 0) return 'Nothing left to book';
  return event.seatsLeft === 0 ? 'Waitlist only' : String(event.seatsLeft);
}

const columns: GridColDef<CatalogEventListItem>[] = [
  {
    field: 'title',
    headerName: EVENT_FIELDS.title.label,
    flex: 2,
    minWidth: 200,
    renderCell: ({ row }) => <RowLink to={`/catalog/${row.id}`}>{row.title}</RowLink>,
  },
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
  const { dataGridProps, filters, setFilters, setCurrentPage } = useListGrid<CatalogEventListItem>({
    sorters: { initial: [{ field: 'startsAt', order: 'asc' }] },
    syncWithLocation: true,
  });
  const onFilters = applyFiltersFromFirstPage({ setCurrentPage, setFilters });
  return (
    <List {...FILL_LIST_PROPS} title="Catalog">
      <SearchFilterForm
        textFilters={[
          { name: 'q', description: EVENT_LIST_CONTROLS.search },
          { name: 'city', description: EVENT_LIST_CONTROLS.city },
        ]}
        filters={filters}
        onChange={onFilters}
      />
      <ListGrid {...dataGridProps} columns={columns} fillsWindow />
    </List>
  );
}
