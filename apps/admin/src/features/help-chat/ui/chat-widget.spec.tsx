import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockHttp, type MockRoute } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';

import { HelpChatProvider } from '../model/help-chat-context';

import { ChatMenuItem } from './chat-menu-item';
import { ChatWidget } from './chat-widget';

import type { Role } from '@ers/shared';

type Handler = (payload?: unknown) => void;

/** A stand-in socket that connects at once, answers like the server and records what is sent. */
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
    // Like the server: resuming or starting a chat is answered with its (here empty) history.
    if (event === 'resume' || event === 'new_chat') {
      queueMicrotask(() => {
        this.serve('history', { chatId: crypto.randomUUID(), messages: [] });
      });
    }
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

/** What the widget sent with a question, the first one. */
function firstAsk(socket: FakeSocket): { id: string } & Record<string, unknown> {
  const ask = socket.emitted.find((sent) => sent.event === 'ask');
  if (ask === undefined) throw new Error('nothing was asked');
  return ask.payload as { id: string } & Record<string, unknown>;
}

function firstSocket(): FakeSocket {
  const socket = sockets[0];
  if (socket === undefined) throw new Error('no socket was opened');
  return socket;
}

vi.mock('../api/chat-socket', () => ({
  openChatSocket: () => {
    const socket = new FakeSocket();
    sockets.push(socket);
    queueMicrotask(() => {
      socket.serve('connect');
    });
    return socket;
  },
}));

function signedInAs(role: Role): MockRoute {
  return {
    method: 'get',
    url: '/auth/session',
    status: 200,
    body: { user: { id: 'u1', email: 'u@demo.test', name: 'U', role }, csrfToken: 't' },
  };
}

/** Most tests do not depend on the role; an organizer can open the sessions screen they use. */
const signedIn = signedInAs('ORGANIZER');

function status(isAvailable: boolean): MockRoute {
  return { method: 'get', url: '/chat/status', status: 200, body: { isAvailable } };
}

/** The chat's menu entry and its panel, as the layout puts them together. */
function HelpChat(): React.JSX.Element {
  return (
    <HelpChatProvider>
      <ChatMenuItem isCollapsed={false} />
      <ChatWidget />
    </HelpChatProvider>
  );
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
        <HelpChat />
      </>
    ),
  });
}

async function openChat(): Promise<HTMLElement> {
  await userEvent.click(await screen.findByRole('button', { name: 'Help chat' }));
  return screen.findByRole('dialog', { name: 'Help chat' });
}

describe('ChatWidget', () => {
  beforeEach(() => {
    sockets.length = 0;
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects nothing until it is opened', async () => {
    const { calls } = mockHttp([signedIn, status(true)]);
    renderOnSessions();

    expect(await screen.findByRole('button', { name: 'Help chat' })).toBeInTheDocument();
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
    const asked = firstAsk(socket);
    socket.serve('chunk', { id: asked.id, text: 'Not below the confirmed seats.' });
    socket.serve('done', { id: asked.id, cancelled: false });

    expect(asked).toEqual({
      id: asked.id,
      resource: 'sessions',
      field: 'capacity',
      question: 'Can I lower it?',
      // The chat the fake server started on connect.
      chatId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    expect(within(dialog).getByText('Can I lower it?')).toBeInTheDocument();
    // Once in the bubble, once in the hidden region that announces finished answers.
    expect(within(dialog).getAllByText('Not below the confirmed seats.')).toHaveLength(2);
  });

  it('starts a new chat, stopping an answer still streaming', async () => {
    mockHttp([signedIn, status(true)]);
    renderOnSessions();
    const dialog = await openChat();
    expect(within(dialog).queryByRole('button', { name: 'New chat' })).not.toBeInTheDocument();
    await userEvent.type(
      await within(dialog).findByRole('textbox', { name: 'Your question' }),
      'Explain{Enter}',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: 'New chat' }));

    expect(within(dialog).queryByText('Explain')).not.toBeInTheDocument();
    expect(firstSocket().emitted.map((sent) => sent.event)).toEqual([
      'resume',
      'ask',
      'cancel',
      'new_chat',
    ]);
    expect(within(dialog).queryByRole('button', { name: 'New chat' })).not.toBeInTheDocument();
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

    expect(firstSocket().emitted.map((entry) => entry.event)).toEqual(['resume', 'ask', 'cancel']);
  });

  it.each([
    ['ORGANIZER', 'Which of my sessions are almost full?'],
    ['CUSTOMER', 'Show my upcoming bookings'],
  ] as const)(
    'asks from a page that is no list or form, with %s starters',
    async (role, starter) => {
      mockHttp([signedInAs(role), status(true)]);
      renderAdminPage({ path: '/', route: '/', element: <HelpChat /> });
      const dialog = await openChat();

      await userEvent.click(await within(dialog).findByRole('button', { name: starter }));

      expect(firstAsk(firstSocket())).toMatchObject({ question: starter });
      expect(firstAsk(firstSocket())).not.toHaveProperty('resource');
    },
  );

  it('shows what the assistant is doing while it searches', async () => {
    mockHttp([signedIn, status(true)]);
    renderOnSessions();
    const dialog = await openChat();
    await userEvent.type(
      await within(dialog).findByRole('textbox', { name: 'Your question' }),
      'Events?{Enter}',
    );

    firstSocket().serve('progress', { id: firstAsk(firstSocket()).id, text: 'Searching events…' });

    expect(within(dialog).getByText('Searching events…')).toBeInTheDocument();
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
    // jsdom lays nothing out, so every element would count as hidden; the entry is on screen here.
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
    mockHttp([signedIn, status(true)]);
    renderOnSessions();
    let dialog = await openChat();
    await userEvent.type(
      await within(dialog).findByRole('textbox', { name: 'Your question' }),
      'Hello?{Enter}',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close help chat' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help chat' })).toHaveFocus();
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
          <HelpChat />
        </>
      ),
    });
    await userEvent.click(await screen.findByRole('textbox', { name: 'Grid search' }));
    const dialog = await openChat();

    await userEvent.type(
      await within(dialog).findByRole('textbox', { name: 'Your question' }),
      'Hi?{Enter}',
    );

    expect(firstAsk(firstSocket())).not.toHaveProperty('field');
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
