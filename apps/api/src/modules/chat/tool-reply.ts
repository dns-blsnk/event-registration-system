import { isRecord, parseJson } from './json.js';
import { OPENED_LIST_FIELD, type ListToOpen } from './tools/tool-navigation.js';

import type { ChatEntry } from './chat-history.store.js';
import type { ToolOutcome } from './tools/chat-toolbox.js';

/**
 * How the model reads a tool's answer, kept in one place: `toolReply` writes it and
 * `compactOldToolResults` shortens it, so the two cannot drift apart.
 */
const RESULT_FIELD = 'result';
const LIST_FIELD = 'list';

/** Stands in for the data of an older tool reply, so the model knows it existed. */
export const OMITTED_RESULT =
  'Left out to save space: this came from an earlier tool call. Call the tool again if you need it.';

/** Whether the list a search asked to show was opened, in words the model can relay. */
function listNote(outcome: { listToOpen?: ListToOpen; notShown?: string }) {
  if (outcome.listToOpen !== undefined) {
    return {
      [LIST_FIELD]: 'Opened in the panel with these filters.',
      [OPENED_LIST_FIELD]: outcome.listToOpen,
    };
  }
  if (outcome.notShown !== undefined) return { [LIST_FIELD]: `Not opened: ${outcome.notShown}` };
  return {};
}

/** What the model reads back from a tool: the data or the error, and whether a list opened. */
export function toolReply(outcome: ToolOutcome): string {
  if ('error' in outcome) return JSON.stringify({ error: outcome.error });
  return JSON.stringify({ [RESULT_FIELD]: outcome.data, ...listNote(outcome) });
}

/**
 * A tool reply without its data: the total and the note about an opened list stay, so the model
 * still knows how many there were and what the user saw. Errors and anything else stay whole.
 */
function shortened(entry: ChatEntry): ChatEntry {
  if (entry.role !== 'tool' || typeof entry.content !== 'string') return entry;
  const reply = parseJson(entry.content);
  if (!isRecord(reply) || !(RESULT_FIELD in reply)) return entry;
  const data = reply[RESULT_FIELD];
  const note = reply[LIST_FIELD];
  const total = isRecord(data) && typeof data.total === 'number' ? data.total : undefined;
  const summary = {
    [RESULT_FIELD]: OMITTED_RESULT,
    ...(total === undefined ? {} : { total }),
    ...(typeof note === 'string' ? { [LIST_FIELD]: note } : {}),
  };
  return { ...entry, content: JSON.stringify(summary) };
}

/**
 * The chat as the model reads it: tool data from turns before the last one that called a tool is
 * left out. Every request resends the whole chat, so old data would be billed again on each
 * question, while follow-ups ("and the second one?") nearly always mean the latest lookup, which
 * stays whole even when a question without tools came after it. Each reply keeps its call id, so
 * every tool call still has its answer.
 */
export function compactOldToolResults(entries: readonly ChatEntry[]): ChatEntry[] {
  const lastReply = entries.findLastIndex((entry) => entry.role === 'tool');
  const keepFrom = entries.findLastIndex(
    (entry, index) => index < lastReply && entry.role === 'user',
  );
  return entries.map((entry, index) => (index < keepFrom ? shortened(entry) : entry));
}
