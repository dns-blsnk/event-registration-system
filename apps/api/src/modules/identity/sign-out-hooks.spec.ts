import { describe, expect, it, vi } from 'vitest';

import { SignOutHooks } from './sign-out-hooks.js';

import type { PinoLogger } from 'nestjs-pino';

function hooksWithLogger() {
  const warn = vi.fn();
  const hooks = new SignOutHooks({ setContext: vi.fn(), warn } as unknown as PinoLogger);
  return { hooks, warn };
}

describe('SignOutHooks', () => {
  it('runs every registered clean-up for the user', async () => {
    const { hooks } = hooksWithLogger();
    const first = vi.fn(() => Promise.resolve());
    const second = vi.fn(() => Promise.resolve());
    hooks.register(first);
    hooks.register(second);

    await hooks.run('user-1');

    expect(first).toHaveBeenCalledWith('user-1');
    expect(second).toHaveBeenCalledWith('user-1');
  });

  it('logs a failing clean-up without its data and still runs the others', async () => {
    const { hooks, warn } = hooksWithLogger();
    const failure = Object.assign(new Error('Command timed out'), {
      command: { args: ['chat text'] },
    });
    const other = vi.fn(() => Promise.resolve());
    hooks.register(() => Promise.reject(failure));
    hooks.register(other);

    await hooks.run('user-1');

    expect(other).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      { err: { name: 'Error', message: 'Command timed out' }, userId: 'user-1' },
      'sign-out clean-up failed',
    );
  });
});
