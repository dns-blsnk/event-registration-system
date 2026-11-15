import { CUSTOMER_FIELDS, CUSTOMER_LIST_CONTROLS, type CustomerListItem } from '@ers/shared';
import { type GridColDef } from '@mui/x-data-grid';
import { List } from '@refinedev/mui';

import { emailColumn } from '../../components/email-column';
import { applyFiltersFromFirstPage, SearchFilterForm } from '../../components/filter-form';
import { formatDateTime } from '../../components/format';
import { ListGrid, useListGrid } from '../../components/list-grid';
import { FILL_LIST_PROPS } from '../../components/page-fill';

const columns: GridColDef<CustomerListItem>[] = [
  { field: 'name', headerName: CUSTOMER_FIELDS.name.label, flex: 1, minWidth: 160 },
  emailColumn({
    field: 'email',
    headerName: CUSTOMER_FIELDS.email.label,
    emailOf: (row) => row.email,
  }),
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
  const { dataGridProps, filters, setFilters, setCurrentPage } = useListGrid<CustomerListItem>({
    sorters: { initial: [{ field: 'name', order: 'asc' }] },
    syncWithLocation: true,
  });
  return (
    <List {...FILL_LIST_PROPS}>
      <SearchFilterForm
        textFilters={[{ name: 'q', description: CUSTOMER_LIST_CONTROLS.search }]}
        filters={filters}
        onChange={applyFiltersFromFirstPage({ setCurrentPage, setFilters })}
      />
      <ListGrid {...dataGridProps} columns={columns} fillsWindow />
    </List>
  );
}
