import { SESSION_FIELDS, type SessionListItem } from '@ers/shared';

import { formatDateTime } from '../../components/format';
import { RowLink } from '../../components/row-link';

import type { GridColDef } from '@mui/x-data-grid';

/** Session columns shared by the sessions list and the sessions table on an event page. */
export const SESSION_COLUMNS: GridColDef<SessionListItem>[] = [
  {
    field: 'title',
    headerName: SESSION_FIELDS.title.label,
    flex: 2,
    minWidth: 180,
    // The session page lists its registrations, so the title is the way in.
    renderCell: ({ row }) => <RowLink to={`/sessions/${row.id}`}>{row.title}</RowLink>,
  },
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
