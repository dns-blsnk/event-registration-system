import { Resource, SESSION_FIELDS, type SessionListItem } from '@ers/shared';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useDataGrid } from '@refinedev/mui';

import { formatDateTime } from '../../components/format';

const columns: GridColDef<SessionListItem>[] = [
  { field: 'title', headerName: SESSION_FIELDS.title.label, flex: 2, minWidth: 180 },
  {
    field: 'speaker',
    headerName: SESSION_FIELDS.speaker.label,
    flex: 1,
    minWidth: 140,
    sortable: false,
  },
  { field: 'room', headerName: SESSION_FIELDS.room.label, minWidth: 110, sortable: false },
  {
    field: 'startsAt',
    headerName: SESSION_FIELDS.startsAt.label,
    minWidth: 170,
    valueFormatter: (value: string) => formatDateTime(value),
  },
  { field: 'capacity', headerName: SESSION_FIELDS.capacity.label, type: 'number' },
  {
    field: 'seatsLeft',
    headerName: SESSION_FIELDS.seatsLeft.label,
    type: 'number',
    sortable: false,
  },
  {
    field: 'waitlistCount',
    headerName: SESSION_FIELDS.waitlistCount.label,
    type: 'number',
    sortable: false,
  },
];

/** The sessions of one event, paged and sorted on the server. */
export function EventSessions({ eventId }: { eventId: string }): React.JSX.Element {
  const { dataGridProps } = useDataGrid<SessionListItem>({
    resource: Resource.SESSIONS,
    filters: { permanent: [{ field: 'eventId', operator: 'eq', value: eventId }] },
    sorters: { initial: [{ field: 'startsAt', order: 'asc' }] },
    syncWithLocation: false,
  });
  return <DataGrid {...dataGridProps} columns={columns} disableColumnFilter autoHeight />;
}
