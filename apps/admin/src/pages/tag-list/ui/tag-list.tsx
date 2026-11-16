import { Action, Resource, TAG_FIELDS, TAG_LIST_CONTROLS, type TagListItem } from '@ers/shared';
import { type GridColDef } from '@mui/x-data-grid';
import { useCan, useInvalidate } from '@refinedev/core';
import { CreateButton, DeleteButton, EditButton, List } from '@refinedev/mui';
import { useCallback, useMemo, useState } from 'react';

import { ACTIONS_COLUMN_HEADER } from '@/shared/lib/grid';
import { applyFiltersFromFirstPage, SearchFilterForm } from '@/shared/ui/filter-form';
import { ListGrid, useListGrid } from '@/shared/ui/list-grid';
import { FILL_LIST_PROPS } from '@/shared/ui/page-fill';

import { TagFormDialog } from './tag-form-dialog';

/** Which dialog is open: none, a new tag, or the tag being renamed. */
type DialogState = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; tag: TagListItem };

/**
 * Tags for staff. Organizers see them to pick in event forms; only admins add, rename or delete,
 * and Refine hides those buttons by the shared permission matrix.
 */
export function TagList(): React.JSX.Element {
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const { dataGridProps, filters, setFilters, setCurrentPage } = useListGrid<TagListItem>({
    sorters: { initial: [{ field: 'name', order: 'asc' }] },
    syncWithLocation: true,
  });
  const { data: editAccess } = useCan({ resource: Resource.TAGS, action: Action.EDIT });
  const canManage = editAccess?.can === true;
  const invalidate = useInvalidate();
  // Events and catalog pages show tag names too; a rename or delete must reach them.
  const refreshTagged = useCallback((): void => {
    void invalidate({ resource: Resource.EVENTS, invalidates: ['list', 'detail'] });
    void invalidate({ resource: Resource.CATALOG, invalidates: ['list', 'detail'] });
  }, [invalidate]);
  // Memoized so the grid keeps its column state (widths) across re-renders.
  const columns = useMemo<GridColDef<TagListItem>[]>(() => {
    const base: GridColDef<TagListItem>[] = [
      { field: 'name', headerName: TAG_FIELDS.name.label, flex: 1, minWidth: 160 },
      {
        field: 'eventCount',
        headerName: TAG_FIELDS.eventCount.label,
        description: TAG_FIELDS.eventCount.help,
        type: 'number',
        minWidth: 100,
      },
    ];
    // Organizers only read tags, so they get no empty actions column.
    if (!canManage) return base;
    return [
      ...base,
      {
        field: 'actions',
        headerName: ACTIONS_COLUMN_HEADER,
        sortable: false,
        disableColumnMenu: true,
        minWidth: 120,
        renderCell: ({ row }) => (
          <>
            <EditButton
              hideText
              recordItemId={row.id}
              aria-label={`Rename ${row.name}`}
              onClick={() => {
                setDialog({ kind: 'edit', tag: row });
              }}
            />
            <DeleteButton
              hideText
              recordItemId={row.id}
              aria-label={`Delete ${row.name}`}
              confirmTitle={`Delete "${row.name}"? It is removed from ${String(row.eventCount)} event(s).`}
              onSuccess={refreshTagged}
            />
          </>
        ),
      },
    ];
  }, [canManage, refreshTagged]);
  return (
    <List
      {...FILL_LIST_PROPS}
      headerButtons={
        <CreateButton
          onClick={() => {
            setDialog({ kind: 'create' });
          }}
        >
          Add tag
        </CreateButton>
      }
    >
      <SearchFilterForm
        textFilters={[{ name: 'q', description: TAG_LIST_CONTROLS.search }]}
        filters={filters}
        onChange={applyFiltersFromFirstPage({ setCurrentPage, setFilters })}
      />
      <ListGrid {...dataGridProps} columns={columns} fillsWindow />
      {dialog.kind !== 'closed' && (
        <TagFormDialog
          tag={dialog.kind === 'edit' ? dialog.tag : undefined}
          onSaved={refreshTagged}
          onClose={() => {
            setDialog({ kind: 'closed' });
          }}
        />
      )}
    </List>
  );
}
