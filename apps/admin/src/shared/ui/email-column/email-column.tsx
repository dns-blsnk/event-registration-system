import Link from '@mui/material/Link';

import type { GridColDef, GridValidRowModel } from '@mui/x-data-grid';

/** Room for a typical address before the cell truncates it. */
const EMAIL_COLUMN_MIN_WIDTH = 200;

/**
 * A mailto: link to the address. The local part is encoded: characters such as "?" or "#" are
 * allowed in it but would otherwise be read as the start of mail headers or a fragment.
 */
export function mailtoHref(email: string): string {
  const at = email.lastIndexOf('@');
  return `mailto:${encodeURIComponent(email.slice(0, at))}${email.slice(at)}`;
}

/**
 * A column of email addresses that open the viewer's mail app. The address stays the cell's value
 * (copy, sorting); the link is only how it is drawn.
 */
export function emailColumn<R extends GridValidRowModel>({
  field,
  headerName,
  emailOf,
  isSortable = true,
}: {
  field: string;
  headerName: string;
  emailOf: (row: R) => string;
  /** Off where the API cannot sort by this address. */
  isSortable?: boolean;
}): GridColDef<R, string> {
  return {
    field,
    headerName,
    sortable: isSortable,
    flex: 1,
    minWidth: EMAIL_COLUMN_MIN_WIDTH,
    valueGetter: (_value, row) => emailOf(row),
    renderCell: ({ value = '' }) => (
      <Link href={mailtoHref(value)} underline="hover">
        {value}
      </Link>
    ),
  };
}
