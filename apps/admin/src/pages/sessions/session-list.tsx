import { SESSION_FIELDS, type SessionListItem } from '@ers/shared';
import { type GridColDef } from '@mui/x-data-grid';
import { List } from '@refinedev/mui';

import { applyFiltersFromFirstPage } from '../../components/filter-form';
import { ListGrid, useListGrid } from '../../components/list-grid';
import { RowLink } from '../../components/row-link';

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
    renderCell: ({ row }) => <RowLink to={`/events/${row.eventId}`}>{row.eventTitle}</RowLink>,
  },
  ...SESSION_COLUMNS,
];

/** Every session the user may see, with the "almost full" filter for spotting sessions to grow. */
export function SessionList(): React.JSX.Element {
  const { dataGridProps, filters, setFilters, setCurrentPage } = useListGrid<SessionListItem>({
    sorters: { initial: [{ field: 'startsAt', order: 'asc' }] },
    syncWithLocation: true,
  });
  return (
    <List>
      <SessionFilters
        filters={filters}
        onChange={applyFiltersFromFirstPage({ setCurrentPage, setFilters })}
      />
      <ListGrid {...dataGridProps} columns={columns} />
    </List>
  );
}
