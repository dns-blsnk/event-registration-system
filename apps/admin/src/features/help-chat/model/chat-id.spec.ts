import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { forgetChatId, keepChatId, readChatId } from './chat-id';

describe('chat id storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps, reads and forgets this tab’s chat', () => {
    expect(readChatId()).toBeUndefined();

    keepChatId('c1');
    expect(readChatId()).toBe('c1');

    forgetChatId();
    expect(readChatId()).toBeUndefined();
  });

  it('works without storage, as in a private window that refuses it', () => {
    const refuse = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(refuse);

    expect(() => {
      keepChatId('c1');
      forgetChatId();
    }).not.toThrow();
    expect(readChatId()).toBeUndefined();
  });
});
