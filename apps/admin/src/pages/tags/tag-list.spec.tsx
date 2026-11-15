import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '../../test/http-mock';
import { renderAdminPage } from '../../test/render-admin';

import { TagList } from './tag-list';

import type { Role, TagListItem } from '@ers/shared';

const ai: TagListItem = { id: 't1', name: 'AI', eventCount: 3 };
const tags: MockRoute = { method: 'get', url: '/tags', status: 200, body: [ai] };

function signedIn(role: Role): MockRoute {
  return {
    method: 'get',
    url: '/auth/session',
    status: 200,
    body: { user: { id: 'u', email: 'u@demo.test', name: 'U', role }, csrfToken: 't' },
  };
}

function bodyOf(call: { data?: unknown } | undefined): Record<string, unknown> {
  return JSON.parse(String(call?.data)) as Record<string, unknown>;
}

function renderList(): void {
  renderAdminPage({ path: '/tags', route: '/tags', element: <TagList /> });
}

describe('TagList', () => {
  it('shows tags with how many events use them', async () => {
    mockHttp([signedIn('ADMIN'), tags]);
    renderList();

    expect(await screen.findByText('AI')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('lets an organizer see tags but not add, rename or delete them', async () => {
    mockHttp([signedIn('ORGANIZER'), tags]);
    renderList();

    expect(await screen.findByText('AI')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Add tag' })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Rename AI' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete AI' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
  });

  it('adds a tag with its name stored the way the API normalizes it', async () => {
    const { calls } = mockHttp([
      signedIn('ADMIN'),
      tags,
      {
        method: 'post',
        url: '/tags',
        status: 201,
        body: { id: 't2', name: 'Security', eventCount: 0 },
      },
      tags,
    ]);
    renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Add tag' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add tag' });
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Name' }),
      ' Cyber   security ',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(bodyOf(calls.find((call) => call.method === 'post'))).toEqual({
      name: 'Cyber security',
    });
  });

  it('shows a name clash the API reports on the field', async () => {
    mockHttp([
      signedIn('ADMIN'),
      tags,
      {
        method: 'post',
        url: '/tags',
        status: 409,
        body: {
          statusCode: 409,
          code: 'CONFLICT',
          message: 'A tag with this name already exists',
          details: [{ field: 'name', messages: ['A tag with this name already exists'] }],
          requestId: 'r',
        },
      },
    ]);
    renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Add tag' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add tag' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'ai');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(
      await within(dialog).findAllByText('A tag with this name already exists'),
    ).not.toHaveLength(0);
  });

  it('does not send a blank name', async () => {
    const { calls } = mockHttp([signedIn('ADMIN'), tags]);
    renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Add tag' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add tag' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), '   ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText('Required')).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'post')).toBe(false);
  });

  it('renames a tag, and closes without a request when the name is unchanged', async () => {
    const { calls } = mockHttp([
      signedIn('ADMIN'),
      tags,
      { method: 'patch', url: '/tags/t1', status: 200, body: { ...ai, name: 'Machine learning' } },
      tags,
    ]);
    renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Rename AI' }));
    let dialog = await screen.findByRole('dialog', { name: 'Rename tag' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(calls.some((call) => call.method === 'patch')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Rename AI' }));
    dialog = await screen.findByRole('dialog', { name: 'Rename tag' });
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Machine learning');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'patch')).toBe(true);
    });
    expect(bodyOf(calls.find((call) => call.method === 'patch'))).toEqual({
      name: 'Machine learning',
    });
  });

  it('deletes a tag after a confirmation that says how many events lose it', async () => {
    const { calls } = mockHttp([
      signedIn('ADMIN'),
      tags,
      { method: 'delete', url: '/tags/t1', status: 204 },
      { method: 'get', url: '/tags', status: 200, body: [] },
    ]);
    renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete AI' }));
    expect(
      await screen.findByText('Delete "AI"? It is removed from 3 event(s).'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'delete' && call.url === '/tags/t1')).toBe(true);
    });
  });
});
