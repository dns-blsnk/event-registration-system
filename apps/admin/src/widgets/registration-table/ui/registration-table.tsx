import { Action, REGISTRATION_FIELDS, Resource, type RegistrationListItem } from '@ers/shared';
import { type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid';
import { useCan } from '@refinedev/core';
import { useState } from 'react';

import { RegistrationStatusChip } from '@/entities/registration';
import { formatDateTime } from '@/shared/lib/format';
import { emailColumn } from '@/shared/ui/email-column';
import { applyFiltersFromFirstPage } from '@/shared/ui/filter-form';
import { ListGrid, useListGrid } from '@/shared/ui/list-grid';
import { RowLink } from '@/shared/ui/row-link';

import { hasBulkAction } from '../model/bulk-selection';

import { RegistrationBulkActions } from './registration-bulk-actions';
import { RegistrationFilters } from './registration-filters';

const columns: GridColDef<RegistrationListItem>[] = [
  {
    field: 'customer',
    headerName: REGISTRATION_FIELDS.customer.label,
    flex: 1,
    minWidth: 200,
    sortable: false,
    valueGetter: (_value, row) => row.customer.name,
  },
  emailColumn({
    field: 'customerEmail',
    headerName: REGISTRATION_FIELDS.customerEmail.label,
    emailOf: (row) => row.customer.email,
    isSortable: false,
  }),
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
      <RowLink to={`/sessions/${row.session.id}`}>{row.session.title}</RowLink>
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

/**
 * The selected rows on the current page that can still be ticked. A row the server refused may come
 * back from a reload with nothing left to apply, so it drops out of the selection here.
 */
function selectedRowsOf(
  model: GridRowSelectionModel,
  rows: readonly RegistrationListItem[],
  isSelectable: (row: RegistrationListItem) => boolean,
): RegistrationListItem[] {
  return rows.filter(
    (row) => isSelectable(row) && (model.type === 'include') === model.ids.has(row.id),
  );
}

interface RegistrationTableProps {
  /** Only this session's registrations, inside its page; the full list keeps filters in the URL. */
  sessionId?: string;
}

/** Registrations with filters and bulk status changes on the selected rows. */
export function RegistrationTable({ sessionId }: RegistrationTableProps): React.JSX.Element {
  const { dataGridProps, filters, setFilters, setCurrentPage, result } =
    useListGrid<RegistrationListItem>({
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
  const now = new Date();
  const isSelectable = (row: RegistrationListItem): boolean => hasBulkAction(row, now);
  const canBulk = bulkAccess?.can === true;
  // Rows nothing applies to (cancelled, attended, an event that did not run) cannot be ticked, and a
  // loaded page of only such rows shows no checkboxes at all.
  const hasRowsToTick = result.data.length === 0 || result.data.some(isSelectable);
  const [selection, setSelection] = useState<GridRowSelectionModel>(NO_SELECTION);
  const applyFilters = applyFiltersFromFirstPage({ setCurrentPage, setFilters });
  const selectedRows = selectedRowsOf(selection, result.data, isSelectable);
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
          selectedRows={selectedRows}
          onDone={(failedIds) => {
            setSelection({ type: 'include', ids: new Set(failedIds) });
          }}
        />
      )}
      <ListGrid
        {...dataGridProps}
        columns={columns}
        fillsWindow={sessionId === undefined}
        checkboxSelection={canBulk && hasRowsToTick}
        isRowSelectable={({ row }: { row: RegistrationListItem }) => isSelectable(row)}
        // The bulk bar above already says how many rows are selected.
        hideFooterSelectedRowCount={canBulk}
        // A selection is of the rows on screen; another page or order starts with none.
        onPaginationModelChange={(model, details) => {
          setSelection(NO_SELECTION);
          dataGridProps.onPaginationModelChange?.(model, details);
        }}
        onSortModelChange={(model, details) => {
          setSelection(NO_SELECTION);
          dataGridProps.onSortModelChange(model, details);
        }}
        rowSelectionModel={{ type: 'include', ids: new Set(selectedRows.map((row) => row.id)) }}
        onRowSelectionModelChange={setSelection}
        {...(sessionId === undefined ? {} : { initialState: EMBEDDED_INITIAL_STATE })}
      />
    </>
  );
}
