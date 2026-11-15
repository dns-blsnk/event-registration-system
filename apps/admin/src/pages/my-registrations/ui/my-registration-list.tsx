import {
  isInCatalog,
  REGISTRATION_FIELDS,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUSES,
  SESSION_FIELDS,
  type MyRegistration,
} from '@ers/shared';
import Stack from '@mui/material/Stack';
import { type GridColDef } from '@mui/x-data-grid';
import { List } from '@refinedev/mui';

import { RegistrationStatusChip } from '@/entities/registration';
import { catalogSessionAnchor } from '@/entities/session';
import { formatDateTime } from '@/shared/lib/format';
import { ACTIONS_COLUMN_HEADER } from '@/shared/lib/grid';
import { applyFiltersFromFirstPage, SelectFilterField } from '@/shared/ui/filter-form';
import { ListGrid, useListGrid } from '@/shared/ui/list-grid';
import { FILL_LIST_PROPS } from '@/shared/ui/page-fill';
import { RowLink } from '@/shared/ui/row-link';

import { canCancel, MyRegistrationCancel } from './my-registration-cancel';

/**
 * The event in the catalog, or one of its sessions there. Only events the catalog still shows
 * (published, not ended) are links; any other booking names them as text.
 */
function catalogPath(row: MyRegistration, sessionId?: string): string {
  const event = `/catalog/${row.event.id}`;
  return sessionId === undefined ? event : `${event}#${catalogSessionAnchor(sessionId)}`;
}

const columns: GridColDef<MyRegistration>[] = [
  {
    field: 'event',
    headerName: REGISTRATION_FIELDS.event.label,
    flex: 1,
    minWidth: 180,
    sortable: false,
    valueGetter: (_value, row) => row.event.title,
    renderCell: ({ row }) =>
      isInCatalog(row.event, new Date()) ? (
        <RowLink to={catalogPath(row)}>{row.event.title}</RowLink>
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
    // The catalog page of the event, scrolled to this session: customers have no session page.
    renderCell: ({ row }) =>
      isInCatalog(row.event, new Date()) ? (
        <RowLink to={catalogPath(row, row.session.id)}>{row.session.title}</RowLink>
      ) : (
        row.session.title
      ),
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
    <List {...FILL_LIST_PROPS} title="My registrations">
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
      <ListGrid {...dataGridProps} columns={columns} fillsWindow />
    </List>
  );
}
