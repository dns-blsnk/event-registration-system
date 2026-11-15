import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockHttp, type MockRoute } from '../test/http-mock';
import { renderAdminPage } from '../test/render-admin';

import { ChatWidget } from './chat-widget';

type Handler = (payload?: unknown) => void;

/** A stand-in socket that is connected at once and records what the widget sends. */
class FakeSocket {
  readonly emitted: { event: string; payload: unknown }[] = [];
  connected = true;
  active = true;
  readonly io = { on: (): void => undefined };
  private readonly handlers = new Map<string, Handler>();

  on(event: string, handler: Handler): this {
    this.handlers.set(event, handler);
    return this;
  }

  emit(event: string, payload?: unknown): this {
    this.emitted.push({ event, payload });
    return this;
  }

  connect(): this {
    return this;
  }

  disconnect(): this {
    return this;
  }

  serve(event: string, payload?: unknown): void {
    act(() => {
      this.handlers.get(event)?.(payload);
    });
  }
}

const sockets: FakeSocket[] = [];

function firstSocket(): FakeSocket {
  const socket = sockets[0];
  if (socket === undefined) throw new Error('no socket was opened');
  return socket;
}

vi.mock('./chat-socket', () => ({
  openChatSocket: () => {
    const socket = new FakeSocket();
    sockets.push(socket);
    queueMicrotask(() => {
      socket.serve('connect');
    });
    return socket;
  },
}));

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/me',
  status: 200,
  body: { user: { id: 'o1', email: 'o@demo.test', name: 'O', role: 'ORGANIZER' }, csrfToken: 't' },
};

function status(isAvailable: boolean): MockRoute {
  return { method: 'get', url: '/chat/status', status: 200, body: { isAvailable } };
}

/** A sessions screen with one form field, and the widget, as the layout shows them. */
function renderOnSessions(): void {
  renderAdminPage({
    path: '/sessions',
    route: '/sessions',
    element: (
      <>
        <label>
          Capacity
          <input name="capacity" />
        </label>
        <ChatWidget />
      </>
    ),
  });
}

async function openChat(): Promise<HTMLElement> {
  await userEvent.click(await screen.findByRole('button', { name: 'Open help chat' }));
  return screen.findByRole('dialog', { name: 'Help chat' });
}

describe('ChatWidget', () => {
  beforeEach(() => {
    sockets.length = 0;
  });

  it('connects nothing until it is opened', async () => {
    const { calls } = mockHttp([signedIn, status(true)]);
    renderOnSessions();

    expect(await screen.findByRole('button', { name: 'Open help chat' })).toBeInTheDocument();
    expect(sockets).toHaveLength(0);
    expect(calls.some((call) => call.url === '/chat/status')).toBe(false);
  });

  it('asks about the open screen and the field the user was last in, and shows the answer', async () => {
    mockHttp([signedIn, status(true)]);
    renderOnSessions();
    await userEvent.click(await screen.findByRole('textbox', { name: 'Capacity' }));
    const dialog = await openChat();

    const question = await within(dialog).findByRole('textbox', { name: 'Your question' });
    expect(question).toHaveAttribute('placeholder', 'Ask about “Capacity”');
    // Focused once the status says the assistant is there and the box is enabled.
    await waitFor(() => {
      expect(question).toHaveFocus();
    });
    await userEvent.type(question, 'Can I lower it?{Enter}');
    const socket = firstSocket();
    const asked = socket.emitted[0]?.payload as { id: string };
    socket.serve('chunk', { id: asked.id, text: 'Not below the confirmed seats.' });
    socket.serve('done', { id: asked.id, cancelled: false });

    expect(socket.emitted[0]).toEqual({
      event: 'ask',
      payload: {
        id: asked.id,
        resource: 'sessions',
        field: 'capacity',
        question: 'Can I lower it?',
      },
    });
    expect(within(dialog).getByText('Can I lower it?')).toBeInTheDocument();
    // Once in the bubble, once in the hidden region that announces finished answers.
    expect(within(dialog).getAllByText('Not below the confirmed seats.')).toHaveLength(2);
  });

  it('offers Stop while an answer streams', async () => {
    mockHttp([signedIn, status(true)]);
    renderOnSessions();
    const dialog = await openChat();
    await userEvent.type(
      await within(dialog).findByRole('textbox', { name: 'Your question' }),
      'Explain{Enter}',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: 'Stop' }));

    expect(firstSocket().emitted.map((entry) => entry.event)).toEqual(['ask', 'cancel']);
  });

  it('says the assistant is unavailable without a model, and opens no socket', async () => {
    mockHttp([signedIn, status(false)]);
    renderOnSessions();
    const dialog = await openChat();

    expect(
      await within(dialog).findByText('The assistant is not available right now.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Your question' })).toBeDisabled();
    expect(sockets).toHaveLength(0);
  });

  it('keeps the conversation when closed and reopened, and gives focus back to the button', async () => {
    mockHttp([signedIn, status(true)]);
    renderOnSessions();
    let dialog = await openChat();
    await userEvent.type(
      await within(dialog).findByRole('textbox', { name: 'Your question' }),
      'Hello?{Enter}',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close help chat' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open help chat' })).toHaveFocus();
    dialog = await openChat();

    expect(within(dialog).getByText('Hello?')).toBeInTheDocument();
    expect(sockets).toHaveLength(1);
  });

  it('sends no field that is not on this screen’s form', async () => {
    mockHttp([signedIn, status(true)]);
    renderAdminPage({
      path: '/sessions',
      route: '/sessions',
      element: (
        <>
          <label>
            Grid search
            <input name="grid-quick-filter" />
          </label>
          <ChatWidget />
        </>
      ),
    });
    await userEvent.click(await screen.findByRole('textbox', { name: 'Grid search' }));
    const dialog = await openChat();

    await userEvent.type(
      await within(dialog).findByRole('textbox', { name: 'Your question' }),
      'Hi?{Enter}',
    );

    expect(firstSocket().emitted[0]?.payload).not.toHaveProperty('field');
  });

  it('says so when the assistant cannot be reached', async () => {
    mockHttp([
      signedIn,
      { method: 'get', url: '/chat/status', status: 500, body: { message: 'boom' } },
    ]);
    renderOnSessions();
    const dialog = await openChat();

    expect(await within(dialog).findByText(/Could not reach the assistant/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Not available/)).toBeInTheDocument();
  });

  it('checks again when the chat is reopened after a failed check', async () => {
    mockHttp([
      signedIn,
      { method: 'get', url: '/chat/status', status: 500, body: { message: 'boom' } },
      status(false),
    ]);
    renderOnSessions();
    const dialog = await openChat();
    await within(dialog).findByText(/Could not reach the assistant/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close help chat' }));

    const reopened = await openChat();

    expect(
      await within(reopened).findByText('The assistant is not available right now.'),
    ).toBeInTheDocument();
  });

  it('does not send an empty question', async () => {
    mockHttp([signedIn, status(true)]);
    renderOnSessions();
    const dialog = await openChat();
    await within(dialog).findByRole('textbox', { name: 'Your question' });

    expect(within(dialog).getByRole('button', { name: 'Send' })).toBeDisabled();
  });
});
