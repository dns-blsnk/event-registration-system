import { CUSTOMER_FIELDS, CUSTOMER_LIST_CONTROLS, type CustomerListItem } from '@ers/shared';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { List, useDataGrid } from '@refinedev/mui';

import { applyFiltersFromFirstPage, SearchFilterForm } from '../../components/filter-form';
import { formatDateTime } from '../../components/format';

const columns: GridColDef<CustomerListItem>[] = [
  { field: 'name', headerName: CUSTOMER_FIELDS.name.label, flex: 1, minWidth: 160 },
  { field: 'email', headerName: CUSTOMER_FIELDS.email.label, flex: 1, minWidth: 200 },
  {
    field: 'createdAt',
    headerName: CUSTOMER_FIELDS.createdAt.label,
    minWidth: 170,
    valueFormatter: (value: string) => formatDateTime(value),
  },
  {
    field: 'registrationCount',
    headerName: CUSTOMER_FIELDS.registrationCount.label,
    description: CUSTOMER_FIELDS.registrationCount.help,
    type: 'number',
    minWidth: 130,
  },
];

/** Customers who booked with the viewer: every customer for admins, own events' bookers for organizers. */
export function CustomerList(): React.JSX.Element {
  const { dataGridProps, filters, setFilters, setCurrentPage } = useDataGrid<CustomerListItem>({
    sorters: { initial: [{ field: 'name', order: 'asc' }] },
    syncWithLocation: true,
  });
  return (
    <List>
      <SearchFilterForm
        textFilters={[{ name: 'q', description: CUSTOMER_LIST_CONTROLS.search }]}
        filters={filters}
        onChange={applyFiltersFromFirstPage({ setCurrentPage, setFilters })}
      />
      <DataGrid {...dataGridProps} columns={columns} disableColumnFilter autoHeight />
    </List>
  );
}
