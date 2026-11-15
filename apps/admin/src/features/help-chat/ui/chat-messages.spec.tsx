import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { starterQuestions } from '../model/chat-state';

import { ChatMessages } from './chat-messages';

describe('ChatMessages', () => {
  it('welcomes with starter questions that ask with one click', async () => {
    const onAsk = vi.fn();
    render(<ChatMessages messages={[]} suggestions={starterQuestions('Capacity')} onAsk={onAsk} />);

    await userEvent.click(screen.getByRole('button', { name: 'What does “Capacity” mean?' }));

    expect(onAsk).toHaveBeenCalledWith('What does “Capacity” mean?');
  });

  it('offers no starter questions while the user cannot ask', () => {
    render(
      <ChatMessages messages={[]} suggestions={starterQuestions(undefined)} onAsk={undefined} />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/Ask what a field means/)).toBeInTheDocument();
  });

  it('shows the conversation instead of the welcome once it has started', () => {
    render(
      <ChatMessages
        messages={[{ id: 'q1', role: 'user', text: 'Hello?', state: 'done' }]}
        suggestions={starterQuestions(undefined)}
        onAsk={vi.fn()}
      />,
    );

    expect(screen.getByText('Hello?')).toBeInTheDocument();
    expect(screen.queryByText(/Ask what a field means/)).not.toBeInTheDocument();
  });
});
