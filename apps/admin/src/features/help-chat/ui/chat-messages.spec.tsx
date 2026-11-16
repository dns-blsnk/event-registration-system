import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { starterQuestions } from '../model/chat-state';

import { ChatMessages } from './chat-messages';

describe('ChatMessages', () => {
  it('welcomes with starter questions that ask with one click', async () => {
    const onAsk = vi.fn();
    render(
      <ChatMessages
        messages={[]}
        suggestions={starterQuestions('ADMIN', 'Capacity')}
        onAsk={onAsk}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'What does “Capacity” mean?' }));

    expect(onAsk).toHaveBeenCalledWith('What does “Capacity” mean?');
  });

  it('offers no starter questions while the user cannot ask', () => {
    render(
      <ChatMessages
        messages={[]}
        suggestions={starterQuestions('CUSTOMER', undefined)}
        onAsk={undefined}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/Ask in any language/)).toBeInTheDocument();
  });

  it('shows the conversation instead of the welcome once it has started', () => {
    render(
      <ChatMessages
        messages={[{ id: 'q1', role: 'user', text: 'Hello?', state: 'done' }]}
        suggestions={starterQuestions('CUSTOMER', undefined)}
        onAsk={vi.fn()}
      />,
    );

    expect(screen.getByText('Hello?')).toBeInTheDocument();
    expect(screen.queryByText(/Ask in any language/)).not.toBeInTheDocument();
  });

  it('shows what the assistant is doing until it writes', () => {
    render(
      <ChatMessages
        messages={[
          { id: 'q1', role: 'user', text: 'Events?', state: 'done' },
          {
            id: 'q1',
            role: 'assistant',
            text: '',
            state: 'streaming',
            progress: 'Searching events…',
          },
        ]}
        suggestions={[]}
        onAsk={vi.fn()}
      />,
    );

    expect(screen.getByText('Searching events…')).toBeInTheDocument();
    expect(screen.queryByText('Thinking…')).not.toBeInTheDocument();
  });
});
