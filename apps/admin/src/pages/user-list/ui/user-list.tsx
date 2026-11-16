import {
  assignableRoles,
  ROLE_LABELS,
  ROLES,
  USER_FIELDS,
  USER_LIST_CONTROLS,
  userManagementRefusal,
  type PublicUser,
  type UserListItem,
} from '@ers/shared';
import { type GridColDef } from '@mui/x-data-grid';
import { useGetIdentity } from '@refinedev/core';
import { CreateButton, DeleteButton, EditButton, List } from '@refinedev/mui';
import { useMemo, useState } from 'react';

import { formatDateTime } from '@/shared/lib/format';
import { ACTIONS_COLUMN_HEADER } from '@/shared/lib/grid';
import { emailColumn } from '@/shared/ui/email-column';
import {
  applyFiltersFromFirstPage,
  SearchFilterForm,
  SelectFilterField,
} from '@/shared/ui/filter-form';
import { ListGrid, useListGrid } from '@/shared/ui/list-grid';
import { FILL_LIST_PROPS } from '@/shared/ui/page-fill';

import { UserFormDialog } from './user-form-dialog';

/** Which dialog is open: none, a new user, or the user being edited. */
type DialogState = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; user: UserListItem };

const BASE_COLUMNS: GridColDef<UserListItem>[] = [
  { field: 'name', headerName: USER_FIELDS.name.label, flex: 1, minWidth: 160 },
  emailColumn({ field: 'email', headerName: USER_FIELDS.email.label, emailOf: (row) => row.email }),
  {
    field: 'role',
    headerName: USER_FIELDS.role.label,
    minWidth: 120,
    valueFormatter: (value: UserListItem['role']) => ROLE_LABELS[value],
  },
  {
    field: 'createdAt',
    headerName: USER_FIELDS.createdAt.label,
    minWidth: 170,
    valueFormatter: (value: string) => formatDateTime(value),
  },
];

/** Users for admins: search, role filter, create, rename, change role and delete. */
export function UserList(): React.JSX.Element {
  const { data: me } = useGetIdentity<PublicUser | null>();
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const { dataGridProps, filters, setFilters, setCurrentPage } = useListGrid<UserListItem>({
    sorters: { initial: [{ field: 'createdAt', order: 'desc' }] },
    syncWithLocation: true,
  });
  const onFilters = applyFiltersFromFirstPage({ setCurrentPage, setFilters });
  // Memoized so the grid keeps its column state (widths) across re-renders.
  const columns = useMemo<GridColDef<UserListItem>[]>(
    () => [
      ...BASE_COLUMNS,
      {
        field: 'actions',
        headerName: ACTIONS_COLUMN_HEADER,
        sortable: false,
        minWidth: 120,
        renderCell: ({ row }) => {
          // Nothing is offered while identity loads. One's own account can be renamed, never
          // deleted; other accounts follow the shared rules (admins are a super admin's to manage).
          if (me === undefined || me === null) return null;
          const isSelf = row.id === me.id;
          const canManage = userManagementRefusal(me.role, row.role) === undefined;
          return (
            <>
              {(isSelf || canManage) && (
                <EditButton
                  hideText
                  recordItemId={row.id}
                  aria-label={`Edit ${row.name}`}
                  onClick={() => {
                    setDialog({ kind: 'edit', user: row });
                  }}
                />
              )}
              {!isSelf && canManage && (
                <DeleteButton hideText recordItemId={row.id} aria-label={`Delete ${row.name}`} />
              )}
            </>
          );
        },
      },
    ],
    [me],
  );
  return (
    <List
      {...FILL_LIST_PROPS}
      headerButtons={
        <CreateButton
          onClick={() => {
            setDialog({ kind: 'create' });
          }}
        >
          Add user
        </CreateButton>
      }
    >
      <SearchFilterForm
        otherFields={['role']}
        textFilters={[{ name: 'q', description: USER_LIST_CONTROLS.search }]}
        filters={filters}
        onChange={onFilters}
      >
        <SelectFilterField
          name="role"
          description={USER_FIELDS.role}
          values={ROLES}
          labels={ROLE_LABELS}
          filters={filters}
          onChange={onFilters}
        />
      </SearchFilterForm>
      <ListGrid {...dataGridProps} columns={columns} fillsWindow />
      {dialog.kind !== 'closed' && (
        <UserFormDialog
          user={dialog.kind === 'edit' ? dialog.user : undefined}
          isSelf={
            dialog.kind === 'edit' && (me === undefined || me === null || dialog.user.id === me.id)
          }
          assignable={me === undefined || me === null ? [] : assignableRoles(me.role)}
          onClose={() => {
            setDialog({ kind: 'closed' });
          }}
        />
      )}
    </List>
  );
}
