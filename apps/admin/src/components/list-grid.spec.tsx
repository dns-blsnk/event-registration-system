import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '../test/http-mock';
import { renderAdminPage } from '../test/render-admin';

import { ListGrid, normalizeColumns, useListGrid } from './list-grid';

import type { GridColDef } from '@mui/x-data-grid';

interface Row {
  id: string;
  title: string;
  seats: number;
}

const COLUMNS: GridColDef<Row>[] = [
  { field: 'title', headerName: 'Title' },
  { field: 'seats', headerName: 'Seats left', type: 'number' },
];

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: { user: { id: 'a1', email: 'a@demo.test', name: 'A', role: 'ADMIN' }, csrfToken: 't' },
};

describe('ListGrid', () => {
  it('says nothing was found and offers no paging or sorting when there are no rows', () => {
    render(<ListGrid rows={[]} rowCount={0} columns={COLUMNS} paginationMode="server" />);

    expect(screen.getByText('Nothing found.')).toBeInTheDocument();
    expect(screen.queryByText(/Rows per page/)).not.toBeInTheDocument();
  });

  it('pages as usual when there are rows', () => {
    render(
      <ListGrid
        rows={[{ id: '1', title: 'Keynote', seats: 4 }]}
        rowCount={30}
        columns={COLUMNS}
        paginationMode="server"
      />,
    );

    expect(screen.getByText('Keynote')).toBeInTheDocument();
    expect(screen.getByText(/Rows per page/)).toBeInTheDocument();
  });
});

describe('normalizeColumns', () => {
  it('never lets the first column be hidden, so the table cannot be left with bare buttons', () => {
    const [first, second] = normalizeColumns(COLUMNS);

    expect(first?.hideable).toBe(false);
    expect(second?.hideable).toBeUndefined();
  });

  it('gives number columns room for their title and header buttons, unless they set their own', () => {
    const [, seats] = normalizeColumns(COLUMNS);
    const [, own] = normalizeColumns([
      { field: 'title' },
      { field: 'seats', type: 'number', minWidth: 80 },
    ]);

    expect(seats?.minWidth).toBe(130);
    expect(own?.minWidth).toBe(80);
  });
});

function GridPropsProbe(): React.JSX.Element {
  const { dataGridProps, setFilters } = useListGrid<Row>({
    resource: 'sessions',
    syncWithLocation: false,
  });
  return (
    <>
      <output>
        {'filterModel' in dataGridProps ? 'has filter model' : 'no filter model'}; rows{' '}
        {String(dataGridProps.rowCount)}
      </output>
      <button
        type="button"
        onClick={() => {
          setFilters([{ field: 'q', operator: 'eq', value: 'nothing' }], 'merge');
        }}
      >
        Search
      </button>
    </>
  );
}

function sessionsRoute(body: Row[]): MockRoute {
  return { method: 'get', url: '/sessions', status: 200, body };
}

describe('useListGrid', () => {
  it('gives the grid no filter model, so filter fields that are not columns are never dropped', async () => {
    mockHttp([signedIn, sessionsRoute([])]);

    renderAdminPage({ path: '/sessions', route: '/sessions', element: <GridPropsProbe /> });

    expect(await screen.findByText(/no filter model/)).toBeInTheDocument();
  });

  it('reports zero rows after a search finds nothing, not the previous total', async () => {
    mockHttp([
      signedIn,
      sessionsRoute([{ id: '1', title: 'Keynote', seats: 4 }]),
      sessionsRoute([]),
    ]);
    renderAdminPage({ path: '/sessions', route: '/sessions', element: <GridPropsProbe /> });
    expect(await screen.findByText(/rows 1/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText(/rows 0/)).toBeInTheDocument();
  });
});
