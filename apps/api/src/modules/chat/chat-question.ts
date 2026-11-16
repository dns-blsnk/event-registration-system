import type { ChatQuestion } from '@ers/shared';

/** Client-chosen ids and field names are short tokens; anything longer is not from the admin. */
const TOKEN_MAX_LENGTH = 64;

function isShortText(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && value.length <= TOKEN_MAX_LENGTH;
}

/** One field of a socket payload, which may be anything; undefined when it is not an object. */
export function fieldOf(payload: unknown, key: string): unknown {
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)[key]
    : undefined;
}

/**
 * Reads an `ask` payload from the socket. Only the shape is checked here; the question text, the
 * screen and the role are checked when the prompt is built. Undefined means a malformed payload.
 */
export function parseChatQuestion(
  payload: unknown,
): (Omit<ChatQuestion, 'resource'> & { resource?: string }) | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const { id, resource, field, question, chatId, timeZone } = payload as Record<string, unknown>;
  if (!isShortText(id) || typeof question !== 'string') return undefined;
  if (
    ![resource, field, chatId, timeZone].every((value) => value === undefined || isShortText(value))
  ) {
    return undefined;
  }
  return {
    id,
    question,
    ...(isShortText(resource) ? { resource } : {}),
    ...(isShortText(field) ? { field } : {}),
    ...(isShortText(chatId) ? { chatId } : {}),
    ...(isShortText(timeZone) ? { timeZone } : {}),
  };
}
