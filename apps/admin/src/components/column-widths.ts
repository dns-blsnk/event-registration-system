import { hasSignedOut, subscribeToSignOut } from '../providers/auth-provider';

import type { GridColDef, GridValidRowModel } from '@mui/x-data-grid';

/** Rough width of one header character in the theme's 14px medium font. */
const HEADER_CHAR_WIDTH = 7.5;
/** The cell padding on both sides of a header title. */
const HEADER_PADDING = 20;
/** One header button: the sort arrow or the column menu. */
const HEADER_BUTTON_WIDTH = 28;

/** The narrowest a column can be without cutting its title or hiding its header buttons. */
export function headerMinWidth(column: GridColDef): number {
  const title = column.headerName ?? column.field;
  const buttons = [column.sortable !== false, column.disableColumnMenu !== true].filter(Boolean);
  return (
    Math.ceil(title.length * HEADER_CHAR_WIDTH) +
    HEADER_PADDING +
    buttons.length * HEADER_BUTTON_WIDTH
  );
}

/**
 * Widths the user set by hand (dragged or double-clicked), per table. Kept in memory only, never in
 * browser storage: they survive moving between pages, and a reload starts from the defaults.
 */
const savedWidths = new Map<string, Map<string, number>>();

/** Drops every remembered width. */
export function forgetWidths(): void {
  savedWidths.clear();
}

// One person's widths are not the next person's in the same tab.
subscribeToSignOut(() => {
  if (hasSignedOut()) forgetWidths();
});

/**
 * A table is known by its columns and whether it fills the page, so a list page and the same
 * columns embedded in another page keep their own widths.
 */
export function tableKeyOf<R extends GridValidRowModel>(
  columns: readonly GridColDef<R>[],
  fillsWindow: boolean,
): string {
  const layout = fillsWindow ? 'page' : 'embedded';
  return `${layout}:${columns.map((column) => column.field).join(',')}`;
}

export function rememberWidth(table: string, field: string, width: number): void {
  const widths = savedWidths.get(table) ?? new Map<string, number>();
  widths.set(field, width);
  savedWidths.set(table, widths);
}

export function savedWidthsOf(table: string): ReadonlyMap<string, number> {
  return savedWidths.get(table) ?? new Map<string, number>();
}

/** A width the user set replaces the column's own; flex would stretch it again. */
export function withSavedWidth<R extends GridValidRowModel>(
  column: GridColDef<R>,
  width: number | undefined,
): GridColDef<R> {
  return width === undefined ? column : { ...column, width, flex: 0 };
}
