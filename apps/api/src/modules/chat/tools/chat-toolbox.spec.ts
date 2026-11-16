import { Action, Resource } from '@ers/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ChatToolbox } from './chat-toolbox.js';

import type { AssistantTool } from './assistant-tool.js';
import type { ModuleRef } from '@nestjs/core';

/** A toolbox whose every tool is this one, to see what startup accepts. */
function toolboxWith(tool: Partial<AssistantTool>): ChatToolbox {
  const complete: AssistantTool = {
    name: 'probe',
    description: 'probe',
    progress: 'Probing…',
    parameters: z.object({}),
    permission: { resource: Resource.EVENTS, action: Action.LIST },
    run: () => Promise.resolve(null),
    ...tool,
  };
  return new ChatToolbox({ get: () => complete } as unknown as ModuleRef);
}

describe('ChatToolbox startup checks', () => {
  it('accepts a list search whose arguments are all filters of its list', () => {
    const toolbox = toolboxWith({
      parameters: z.object({ city: z.string().optional(), show: z.boolean().optional() }),
      listView: { withoutDays: 'upcoming' },
    });

    expect(() => {
      toolbox.onModuleInit();
    }).not.toThrow();
  });

  it.each([
    ['a show argument without a list', { parameters: z.object({ show: z.boolean() }) }],
    [
      'a list without a show argument',
      { parameters: z.object({ city: z.string() }), listView: { withoutDays: 'upcoming' } },
    ],
    [
      'an argument that is not a filter of the list',
      {
        parameters: z.object({ town: z.string(), show: z.boolean() }),
        listView: { withoutDays: 'upcoming' },
      },
    ],
    [
      'a list the chat may not open',
      {
        parameters: z.object({ show: z.boolean() }),
        permission: { resource: Resource.USERS, action: Action.LIST },
        listView: { withoutDays: 'everything' },
      },
    ],
  ] as const)('refuses to start with %s', (_case, tool) => {
    expect(() => {
      toolboxWith(tool).onModuleInit();
    }).toThrow();
  });
});
