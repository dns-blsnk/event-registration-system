import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { authProvider } from '@/entities/viewer';
import { rememberWidth, savedWidthsOf, tableKeyOf } from '@/shared/ui/column-widths';
import { mockHttp } from '@/test/http-mock';

import { forgetPersonalStateOnSignOut } from './session-cleanup';

describe('forgetPersonalStateOnSignOut', () => {
  it('forgets cached answers, column widths and the chat when the user signs out', async () => {
    const queryClient = new QueryClient();
    forgetPersonalStateOnSignOut(queryClient);
    queryClient.setQueryData(['identity'], { name: 'Previous user' });
    mockHttp([
      {
        method: 'post',
        url: '/auth/login',
        status: 200,
        body: {
          user: { id: 'a1', email: 'a@demo.test', name: 'A', role: 'ADMIN' },
          csrfToken: 't',
        },
      },
      { method: 'post', url: '/auth/logout', status: 204 },
    ]);
    await authProvider.login({ email: 'a@demo.test', password: 'long-enough-pass' });
    const table = tableKeyOf([{ field: 'title' }], true);
    rememberWidth(table, 'title', 300);
    // The tab's chat, as the help chat keeps it; a renamed key would leave this behind and fail.
    sessionStorage.setItem('ers.chatId', 'a-chat');

    await authProvider.logout({});

    expect(savedWidthsOf(table).size).toBe(0);
    expect(sessionStorage).toHaveLength(0);
    expect(queryClient.getQueryData(['identity'])).toBeUndefined();
  });
});
