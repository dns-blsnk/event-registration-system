import { Resource, type SessionListItem } from '@ers/shared';
import { DataGrid } from '@mui/x-data-grid';
import { useDataGrid } from '@refinedev/mui';

import { SESSION_COLUMNS } from '../sessions/session-columns';

/** The sessions of one event, paged and sorted on the server. */
export function EventSessions({ eventId }: { eventId: string }): React.JSX.Element {
  const { dataGridProps } = useDataGrid<SessionListItem>({
    resource: Resource.SESSIONS,
    filters: { permanent: [{ field: 'eventId', operator: 'eq', value: eventId }] },
    sorters: { initial: [{ field: 'startsAt', order: 'asc' }] },
    syncWithLocation: false,
  });
  return <DataGrid {...dataGridProps} columns={SESSION_COLUMNS} disableColumnFilter autoHeight />;
}
