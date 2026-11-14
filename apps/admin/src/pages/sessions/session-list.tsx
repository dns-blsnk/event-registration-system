import { SESSION_FIELDS, type SessionListItem } from '@ers/shared';
import Link from '@mui/material/Link';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { List, useDataGrid } from '@refinedev/mui';
import { Link as RouterLink } from 'react-router';

import { applyFiltersFromFirstPage } from '../../components/filter-form';

import { SESSION_COLUMNS } from './session-columns';
import { SessionFilters } from './session-filters';

const columns: GridColDef<SessionListItem>[] = [
  {
    field: 'eventTitle',
    headerName: SESSION_FIELDS.event.label,
    flex: 1,
    minWidth: 180,
    sortable: false,
    // Sessions are managed on their event's page, so the event is the way in.
    renderCell: ({ row }) => (
      <Link component={RouterLink} to={`/events/${row.eventId}`}>
        {row.eventTitle}
      </Link>
    ),
  },
  ...SESSION_COLUMNS,
];

/** Every session the user may see, with the "almost full" filter for spotting sessions to grow. */
export function SessionList(): React.JSX.Element {
  const { dataGridProps, filters, setFilters, setCurrentPage } = useDataGrid<SessionListItem>({
    sorters: { initial: [{ field: 'startsAt', order: 'asc' }] },
    syncWithLocation: true,
  });
  return (
    <List>
      <SessionFilters
        filters={filters}
        onChange={applyFiltersFromFirstPage({ setCurrentPage, setFilters })}
      />
      <DataGrid {...dataGridProps} columns={columns} disableColumnFilter autoHeight />
    </List>
  );
}
