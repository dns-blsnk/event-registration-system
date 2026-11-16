import { describe, expect, it } from 'vitest';

import { toDisplayMessages, type ChatEntry } from './chat-history.store.js';

const question = (text: string): ChatEntry => ({ role: 'user', content: text });
const answer = (text: string): ChatEntry => ({ role: 'assistant', content: text });
const toolCall: ChatEntry = {
  role: 'assistant',
  content: null,
  tool_calls: [
    { id: 'c1', type: 'function', function: { name: 'search_events', arguments: '{}' } },
  ],
};
const toolResult: ChatEntry = { role: 'tool', tool_call_id: 'c1', content: '{"total":0}' };

/** Turns of four entries: question, tool call, tool result, answer. */
function turns(count: number): ChatEntry[] {
  return Array.from({ length: count }, (_, index) => [
    question(`q${String(index)}`),
    toolCall,
    toolResult,
    answer(`a${String(index)}`),
  ]).flat();
}

describe('toDisplayMessages', () => {
  it('shows the questions and the final answers, not the tool traffic', () => {
    expect(toDisplayMessages(turns(1))).toEqual([
      { role: 'user', text: 'q0' },
      { role: 'assistant', text: 'a0' },
    ]);
  });

  it('joins the text of every round of one answer, as the user saw it stream', () => {
    const lookingUp: ChatEntry = { ...toolCall, content: 'Let me look.' };

    expect(toDisplayMessages([question('q'), lookingUp, toolResult, answer('None.')])).toEqual([
      { role: 'user', text: 'q' },
      { role: 'assistant', text: 'Let me look.\n\nNone.' },
    ]);
  });

  it('keeps the list a tool opened on the answer it belongs to', () => {
    const opened: ChatEntry = {
      role: 'tool',
      tool_call_id: 'c1',
      content: JSON.stringify({
        result: { total: 2 },
        openedList: { resource: 'events', filters: { city: 'Tallinn' } },
      }),
    };

    expect(toDisplayMessages([question('q'), toolCall, opened, answer('Two.')])).toEqual([
      { role: 'user', text: 'q' },
      {
        role: 'assistant',
        text: 'Two.',
        list: { resource: 'events', filters: { city: 'Tallinn' } },
      },
    ]);
  });

  it('drops a kept list the list rules no longer accept', () => {
    const opened: ChatEntry = {
      role: 'tool',
      tool_call_id: 'c1',
      content: JSON.stringify({ openedList: { resource: 'events', filters: { color: 'red' } } }),
    };

    expect(toDisplayMessages([question('q'), toolCall, opened, answer('Two.')])).toEqual([
      { role: 'user', text: 'q' },
      { role: 'assistant', text: 'Two.' },
    ]);
  });

  it('skips an empty answer and the system prompt', () => {
    expect(
      toDisplayMessages([{ role: 'system', content: 'rules' }, question('q'), answer('')]),
    ).toEqual([{ role: 'user', text: 'q' }]);
  });
});
