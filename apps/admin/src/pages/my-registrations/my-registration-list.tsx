import {
  REGISTRATION_FIELDS,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUSES,
  SESSION_FIELDS,
  type MyRegistration,
} from '@ers/shared';
import Stack from '@mui/material/Stack';
import { type GridColDef } from '@mui/x-data-grid';
import { List } from '@refinedev/mui';

import { applyFiltersFromFirstPage, SelectFilterField } from '../../components/filter-form';
import { formatDateTime } from '../../components/format';
import { ACTIONS_COLUMN_HEADER } from '../../components/grid';
import { ListGrid, useListGrid } from '../../components/list-grid';
import { RegistrationStatusChip } from '../../components/registration-status-chip';
import { RowLink } from '../../components/row-link';

import { canCancel, MyRegistrationCancel } from './my-registration-cancel';

const columns: GridColDef<MyRegistration>[] = [
  {
    field: 'event',
    headerName: REGISTRATION_FIELDS.event.label,
    flex: 1,
    minWidth: 180,
    sortable: false,
    // The catalog only shows events still open to customers; past bookings name the event as text.
    renderCell: ({ row }) =>
      canCancel(row, new Date()) ? (
        <RowLink to={`/catalog/${row.event.id}`}>{row.event.title}</RowLink>
      ) : (
        row.event.title
      ),
  },
  {
    field: 'session',
    headerName: REGISTRATION_FIELDS.session.label,
    flex: 1,
    minWidth: 160,
    sortable: false,
    valueGetter: (_value, row) => row.session.title,
  },
  {
    field: 'startsAt',
    headerName: SESSION_FIELDS.startsAt.label,
    minWidth: 170,
    sortable: false,
    valueGetter: (_value, row) => formatDateTime(row.session.startsAt),
  },
  {
    field: 'status',
    headerName: REGISTRATION_FIELDS.status.label,
    minWidth: 170,
    sortable: false,
    renderCell: ({ row }) => (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
        <RegistrationStatusChip status={row.status} />
        {row.waitlistPosition !== null && <span>#{String(row.waitlistPosition)}</span>}
      </Stack>
    ),
  },
  {
    field: 'createdAt',
    headerName: REGISTRATION_FIELDS.createdAt.label,
    minWidth: 170,
    valueFormatter: (value: string) => formatDateTime(value),
  },
  {
    field: 'actions',
    headerName: ACTIONS_COLUMN_HEADER,
    sortable: false,
    disableColumnMenu: true,
    minWidth: 110,
    renderCell: ({ row }) =>
      canCancel(row, new Date()) ? <MyRegistrationCancel registration={row} /> : null,
  },
];

/** The signed-in customer's bookings, newest first, with cancellation while it is still allowed. */
export function MyRegistrationList(): React.JSX.Element {
  const { dataGridProps, filters, setFilters, setCurrentPage } = useListGrid<MyRegistration>({
    sorters: { initial: [{ field: 'createdAt', order: 'desc' }] },
    syncWithLocation: true,
  });
  return (
    <List title="My registrations">
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <SelectFilterField
          name="status"
          description={REGISTRATION_FIELDS.status}
          values={REGISTRATION_STATUSES}
          labels={REGISTRATION_STATUS_LABELS}
          filters={filters}
          onChange={applyFiltersFromFirstPage({ setCurrentPage, setFilters })}
        />
      </Stack>
      <ListGrid {...dataGridProps} columns={columns} />
    </List>
  );
}
