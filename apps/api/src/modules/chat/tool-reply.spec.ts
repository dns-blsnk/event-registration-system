import { describe, expect, it } from 'vitest';

import { compactOldToolResults, OMITTED_RESULT, toolReply } from './tool-reply.js';

import type { ChatEntry } from './chat-history.store.js';
import type { ToolOutcome } from './tools/chat-toolbox.js';

const rows = { total: 37, events: [{ id: 'e1', title: 'React Day' }] };
const opened: ToolOutcome = {
  data: rows,
  listToOpen: { resource: 'events', filters: { city: 'Tallinn' } },
};

/** A question answered after one tool call, its reply written the way the agent writes it. */
function searchTurn(question: string, outcome: ToolOutcome, callId: string): ChatEntry[] {
  return [
    { role: 'user', content: question },
    {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: callId, type: 'function', function: { name: 'search', arguments: '{}' } }],
    },
    { role: 'tool', tool_call_id: callId, content: toolReply(outcome) },
    { role: 'assistant', content: 'Here they are.' },
  ];
}

/** What the model reads in a tool entry, parsed. */
function replyOf(entry: ChatEntry | undefined): unknown {
  return typeof entry?.content === 'string' ? (JSON.parse(entry.content) as unknown) : undefined;
}

function plainTurn(question: string): ChatEntry[] {
  return [
    { role: 'user', content: question },
    { role: 'assistant', content: 'It means you wait for a seat.' },
  ];
}

describe('toolReply', () => {
  it('gives the data, and says when the list opened', () => {
    expect(JSON.parse(toolReply(opened))).toEqual({
      result: rows,
      list: 'Opened in the panel with these filters.',
      openedList: { resource: 'events', filters: { city: 'Tallinn' } },
    });
  });

  it('says why a list could not open', () => {
    expect(JSON.parse(toolReply({ data: rows, notShown: 'bad filter' }))).toMatchObject({
      list: 'Not opened: bad filter',
    });
  });

  it('gives only the error when the tool refused', () => {
    expect(JSON.parse(toolReply({ error: 'Event not found' }))).toEqual({
      error: 'Event not found',
    });
  });
});

describe('compactOldToolResults', () => {
  it('keeps the data of the latest lookup, which follow-up questions refer to', () => {
    const entries = searchTurn('Events?', { data: rows }, 'c1');

    expect(compactOldToolResults(entries)).toEqual(entries);
  });

  it('keeps the latest lookup whole when a question without tools came after it', () => {
    const entries = [...searchTurn('Events?', { data: rows }, 'c1'), ...plainTurn('Waitlist?')];

    expect(compactOldToolResults(entries)).toEqual(entries);
  });

  it('leaves out the data of earlier lookups but keeps the call id, total and list note', () => {
    const entries = [
      ...searchTurn('Events?', opened, 'c1'),
      ...searchTurn('Sessions?', { data: rows }, 'c2'),
    ];

    const compacted = compactOldToolResults(entries);

    expect(compacted[2]).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
    expect(replyOf(compacted[2])).toEqual({
      result: OMITTED_RESULT,
      total: 37,
      list: 'Opened in the panel with these filters.',
    });
    expect(compacted.slice(4)).toEqual(entries.slice(4));
  });

  it('keeps an earlier reply without a total, such as one event, as just the note', () => {
    const entries = [
      ...searchTurn('That event?', { data: { id: 'e1' } }, 'c1'),
      ...searchTurn('Tags?', { data: rows }, 'c2'),
    ];

    expect(replyOf(compactOldToolResults(entries)[2])).toEqual({
      result: OMITTED_RESULT,
    });
  });

  it.each([
    ['an error', toolReply({ error: 'Event not found' })],
    ['a reply that is not JSON', 'not json'],
  ])('leaves %s from an earlier turn as it is', (_case, content) => {
    const entries: ChatEntry[] = [
      { role: 'user', content: 'Events?' },
      { role: 'tool', tool_call_id: 'c1', content },
      ...searchTurn('And now?', { data: rows }, 'c2'),
    ];

    expect(compactOldToolResults(entries)).toEqual(entries);
  });

  it('changes nothing in a chat without tool calls', () => {
    const entries = [...plainTurn('Waitlist?'), ...plainTurn('Draft?')];

    expect(compactOldToolResults(entries)).toEqual(entries);
  });
});
