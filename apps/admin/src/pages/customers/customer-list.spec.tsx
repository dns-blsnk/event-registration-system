import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '../../test/http-mock';
import { renderAdminPage } from '../../test/render-admin';

import { CustomerList } from './customer-list';

import type { CustomerListItem } from '@ers/shared';

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: { user: { id: 'o1', email: 'o@demo.test', name: 'O', role: 'ORGANIZER' }, csrfToken: 't' },
};

const ann: CustomerListItem = {
  id: 'c1',
  name: 'Ann Customer',
  email: 'ann@demo.test',
  createdAt: '2026-11-01T09:00:00Z',
  registrationCount: 4,
};
const customers: MockRoute = { method: 'get', url: '/customers', status: 200, body: [ann] };

describe('CustomerList', () => {
  it('shows customers with the registrations the viewer can see', async () => {
    mockHttp([signedIn, customers]);
    renderAdminPage({ path: '/customers', route: '/customers', element: <CustomerList /> });

    expect(await screen.findByText('Ann Customer')).toBeInTheDocument();
    // The address opens the viewer's mail app.
    expect(screen.getByRole('link', { name: 'ann@demo.test' })).toHaveAttribute(
      'href',
      'mailto:ann@demo.test',
    );
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows the same list to an admin, with every customer the API returns', async () => {
    mockHttp([
      {
        ...signedIn,
        body: {
          user: { id: 'a1', email: 'a@demo.test', name: 'A', role: 'ADMIN' },
          csrfToken: 't',
        },
      },
      customers,
    ]);
    renderAdminPage({ path: '/customers', route: '/customers', element: <CustomerList /> });

    expect(await screen.findByText('Ann Customer')).toBeInTheDocument();
  });

  it('sorts by registrations on the server', async () => {
    const { calls } = mockHttp([signedIn, customers, customers]);
    renderAdminPage({ path: '/customers', route: '/customers', element: <CustomerList /> });
    await screen.findByText('Ann Customer');

    await userEvent.click(screen.getByRole('columnheader', { name: /Registrations/ }));

    await waitFor(() => {
      const last = calls.filter((call) => call.url?.startsWith('/customers')).at(-1);
      expect(String(last?.url)).toContain('_sort=registrationCount');
    });
  });

  it('searches by name or email on the server', async () => {
    const { calls } = mockHttp([signedIn, customers, customers]);
    renderAdminPage({ path: '/customers', route: '/customers', element: <CustomerList /> });
    await screen.findByText('Ann Customer');

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'ann@{Enter}');

    await waitFor(() => {
      const last = calls.filter((call) => call.url?.startsWith('/customers')).at(-1);
      expect(String(last?.url)).toContain('q=ann%40');
    });
  });
});
