import { Resource, SessionPhase, sessionPhase, type SessionListItem } from '@ers/shared';
import Box from '@mui/material/Box';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { CreateButton, DeleteButton, EditButton, useDataGrid } from '@refinedev/mui';
import { useMemo, useState } from 'react';

import { SESSION_COLUMNS } from '../sessions/session-columns';
import { SessionFormDialog, type SessionDialogTarget } from '../sessions/session-form-dialog';

interface EventSessionsProps {
  eventId: string;
  /** False for completed and cancelled events: their sessions are history. */
  canChange: boolean;
}

/** Ended sessions are history; the API refuses any change to them. */
function canEditSession(session: SessionListItem): boolean {
  const range = { startsAt: new Date(session.startsAt), endsAt: new Date(session.endsAt) };
  return sessionPhase(range, new Date()) !== SessionPhase.ENDED;
}

/** Sessions with bookings stay, so nobody's booking disappears; the API checks this too. */
function canDeleteSession(session: SessionListItem): boolean {
  return session.confirmedCount === 0 && session.waitlistCount === 0;
}

/** The sessions of one event, paged and sorted on the server, added and edited in a dialog. */
export function EventSessions({ eventId, canChange }: EventSessionsProps): React.JSX.Element {
  const [dialog, setDialog] = useState<SessionDialogTarget | undefined>();
  const { dataGridProps } = useDataGrid<SessionListItem>({
    resource: Resource.SESSIONS,
    filters: { permanent: [{ field: 'eventId', operator: 'eq', value: eventId }] },
    sorters: { initial: [{ field: 'startsAt', order: 'asc' }] },
    syncWithLocation: false,
  });
  // Memoized so the grid keeps its column state (widths) across re-renders.
  const columns = useMemo<GridColDef<SessionListItem>[]>(() => {
    if (!canChange) return SESSION_COLUMNS;
    const actions: GridColDef<SessionListItem> = {
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      minWidth: 120,
      renderCell: ({ row }) => (
        <>
          {canEditSession(row) && (
            <EditButton
              hideText
              resource={Resource.SESSIONS}
              recordItemId={row.id}
              aria-label={`Edit ${row.title}`}
              onClick={() => {
                setDialog({ eventId, session: row });
              }}
            />
          )}
          {canDeleteSession(row) && (
            <DeleteButton
              hideText
              resource={Resource.SESSIONS}
              recordItemId={row.id}
              aria-label={`Delete ${row.title}`}
            />
          )}
        </>
      ),
    };
    return [...SESSION_COLUMNS, actions];
  }, [canChange, eventId]);
  return (
    <>
      {canChange && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <CreateButton
            resource={Resource.SESSIONS}
            onClick={() => {
              setDialog({ eventId });
            }}
          >
            Add session
          </CreateButton>
        </Box>
      )}
      <DataGrid {...dataGridProps} columns={columns} disableColumnFilter autoHeight />
      {dialog !== undefined && (
        <SessionFormDialog
          target={dialog}
          onClose={() => {
            setDialog(undefined);
          }}
        />
      )}
    </>
  );
}
