import { Action, REGISTRATION_FIELDS, Resource, type RegistrationListItem } from '@ers/shared';
import Link from '@mui/material/Link';
import { DataGrid, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid';
import { useCan } from '@refinedev/core';
import { useDataGrid } from '@refinedev/mui';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';

import { applyFiltersFromFirstPage } from '../../components/filter-form';
import { formatDateTime } from '../../components/format';
import { RegistrationStatusChip } from '../../components/registration-status-chip';

import { RegistrationBulkActions } from './registration-bulk-actions';
import { RegistrationFilters } from './registration-filters';

const columns: GridColDef<RegistrationListItem>[] = [
  {
    field: 'customer',
    headerName: REGISTRATION_FIELDS.customer.label,
    flex: 1,
    minWidth: 200,
    sortable: false,
    valueGetter: (_value, row) => `${row.customer.name} <${row.customer.email}>`,
  },
  {
    field: 'event',
    headerName: REGISTRATION_FIELDS.event.label,
    flex: 1,
    minWidth: 160,
    sortable: false,
    valueGetter: (_value, row) => row.event.title,
  },
  {
    field: 'session',
    headerName: REGISTRATION_FIELDS.session.label,
    flex: 1,
    minWidth: 160,
    sortable: false,
    // The title stays the cell's value (copy, quick filter); the link is only how it is drawn.
    valueGetter: (_value, row) => row.session.title,
    renderCell: ({ row }) => (
      <Link component={RouterLink} to={`/sessions/${row.session.id}`}>
        {row.session.title}
      </Link>
    ),
  },
  {
    field: 'status',
    headerName: REGISTRATION_FIELDS.status.label,
    minWidth: 130,
    renderCell: ({ row }) => <RegistrationStatusChip status={row.status} />,
  },
  {
    field: 'createdAt',
    headerName: REGISTRATION_FIELDS.createdAt.label,
    minWidth: 170,
    valueFormatter: (value: string) => formatDateTime(value),
  },
];

/** Inside a session page the event and session columns would repeat the page itself. */
const EMBEDDED_INITIAL_STATE = {
  columns: { columnVisibilityModel: { event: false, session: false } },
};

const NO_SELECTION: GridRowSelectionModel = { type: 'include', ids: new Set() };

/** The selected ids on the current page; "exclude" is what the header checkbox produces. */
function selectedIdsOf(
  model: GridRowSelectionModel,
  rows: readonly RegistrationListItem[],
): string[] {
  if (model.type === 'include') return [...model.ids].map(String);
  return rows.filter((row) => !model.ids.has(row.id)).map((row) => row.id);
}

interface RegistrationTableProps {
  /** Only this session's registrations, inside its page; the full list keeps filters in the URL. */
  sessionId?: string;
}

/** Registrations with filters and bulk status changes on the selected rows. */
export function RegistrationTable({ sessionId }: RegistrationTableProps): React.JSX.Element {
  const { dataGridProps, filters, setFilters, setCurrentPage, result } =
    useDataGrid<RegistrationListItem>({
      resource: Resource.REGISTRATIONS,
      sorters: { initial: [{ field: 'createdAt', order: 'desc' }] },
      ...(sessionId === undefined
        ? { syncWithLocation: true }
        : {
            syncWithLocation: false,
            filters: { permanent: [{ field: 'sessionId', operator: 'eq', value: sessionId }] },
          }),
    });
  const { data: bulkAccess } = useCan({
    resource: Resource.REGISTRATIONS,
    action: Action.BULK_STATUS,
  });
  const canBulk = bulkAccess?.can === true;
  const [selection, setSelection] = useState<GridRowSelectionModel>(NO_SELECTION);
  const applyFilters = applyFiltersFromFirstPage({ setCurrentPage, setFilters });
  const selectedIds = selectedIdsOf(selection, result.data);
  return (
    <>
      <RegistrationFilters
        filters={filters}
        onChange={(changed) => {
          setSelection(NO_SELECTION);
          applyFilters(changed);
        }}
      />
      {canBulk && (
        <RegistrationBulkActions
          selectedIds={selectedIds}
          onDone={(failedIds) => {
            setSelection({ type: 'include', ids: new Set(failedIds) });
          }}
        />
      )}
      <DataGrid
        {...dataGridProps}
        columns={columns}
        checkboxSelection={canBulk}
        // A selection is of the rows on screen; another page or order starts with none.
        onPaginationModelChange={(model, details) => {
          setSelection(NO_SELECTION);
          dataGridProps.onPaginationModelChange?.(model, details);
        }}
        onSortModelChange={(model, details) => {
          setSelection(NO_SELECTION);
          dataGridProps.onSortModelChange(model, details);
        }}
        rowSelectionModel={selection}
        onRowSelectionModelChange={setSelection}
        {...(sessionId === undefined ? {} : { initialState: EMBEDDED_INITIAL_STATE })}
        disableColumnFilter
        autoHeight
      />
    </>
  );
}
