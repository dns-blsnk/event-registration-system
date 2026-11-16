/**
 * The id of this tab's chat with the assistant. It lives in sessionStorage: it survives a reload
 * and closing the chat panel, and is gone with the tab. Storage can be missing or refuse access
 * (private mode, blocked site data), so every access is guarded; without it the chat just starts
 * fresh after a reload.
 */
const CHAT_ID_KEY = 'ers.chatId';

export function readChatId(): string | undefined {
  try {
    return sessionStorage.getItem(CHAT_ID_KEY) ?? undefined;
  } catch {
    // Recovered on purpose: no storage means no chat to resume.
    return undefined;
  }
}

export function keepChatId(chatId: string): void {
  try {
    sessionStorage.setItem(CHAT_ID_KEY, chatId);
  } catch {
    // Recovered on purpose: the chat still works, it is only not resumed after a reload.
  }
}

/** Forgets this tab's chat, e.g. on sign-out, so the next person in the tab never resumes it. */
export function forgetChatId(): void {
  try {
    sessionStorage.removeItem(CHAT_ID_KEY);
  } catch {
    // Recovered on purpose: the server deletes the user's chats on sign-out anyway.
  }
}
