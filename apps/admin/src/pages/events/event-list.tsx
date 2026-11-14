import { EVENT_FIELDS, type EventListItem } from '@ers/shared';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { List, ShowButton, useDataGrid } from '@refinedev/mui';

import { EventStatusChip } from '../../components/event-status-chip';
import { formatDateTime, formatPercent } from '../../components/format';

import { EventFilters } from './event-filters';

/** Columns the API can sort by; the rest are computed per row and stay unsortable. */
const columns: GridColDef<EventListItem>[] = [
  { field: 'title', headerName: EVENT_FIELDS.title.label, flex: 2, minWidth: 200 },
  { field: 'city', headerName: EVENT_FIELDS.city.label, flex: 1, minWidth: 120 },
  {
    field: 'startsAt',
    headerName: EVENT_FIELDS.startsAt.label,
    minWidth: 170,
    valueFormatter: (value: string) => formatDateTime(value),
  },
  {
    field: 'status',
    headerName: EVENT_FIELDS.status.label,
    minWidth: 130,
    renderCell: ({ row }) => <EventStatusChip status={row.status} />,
  },
  {
    field: 'organizer',
    headerName: EVENT_FIELDS.organizer.label,
    minWidth: 160,
    sortable: false,
    valueGetter: (_value, row) => row.organizer.name,
  },
  {
    field: 'sessionsCount',
    headerName: EVENT_FIELDS.sessionsCount.label,
    type: 'number',
    sortable: false,
  },
  {
    field: 'fillRate',
    headerName: EVENT_FIELDS.fillRate.label,
    type: 'number',
    sortable: false,
    valueFormatter: (value: number) => formatPercent(value),
  },
  {
    field: 'actions',
    headerName: 'Open',
    sortable: false,
    hideable: false,
    disableColumnMenu: true,
    minWidth: 90,
    renderCell: ({ row }) => <ShowButton hideText recordItemId={row.id} />,
  },
];

/** Events with server-side paging, sorting and filters; organizers only ever see their own. */
export function EventList(): React.JSX.Element {
  const { dataGridProps, filters, setFilters, setCurrentPage } = useDataGrid<EventListItem>({
    sorters: { initial: [{ field: 'startsAt', order: 'asc' }] },
    syncWithLocation: true,
  });
  return (
    <List>
      <EventFilters
        filters={filters}
        onChange={(next) => {
          // A new filter starts from the first page; staying on page 3 of the old result shows nothing.
          setCurrentPage(1);
          setFilters(next, 'merge');
        }}
      />
      <DataGrid {...dataGridProps} columns={columns} disableColumnFilter autoHeight />
    </List>
  );
}
