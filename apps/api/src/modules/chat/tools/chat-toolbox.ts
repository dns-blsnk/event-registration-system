import { can, CHAT_NAVIGATION, isChatNavigableResource } from '@ers/shared';
import { Injectable, type OnModuleInit, type Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { z } from 'zod';

import { DomainError } from '../../../common/errors/domain-error.js';

import { SearchCatalogTool, SearchMyRegistrationsTool } from './customer-tools.js';
import { GetEventTool, SearchEventsTool } from './event-tools.js';
import {
  ListTagsTool,
  SearchCustomersTool,
  SearchRegistrationsTool,
  SearchSessionsTool,
} from './staff-tools.js';
import { listToOpen, type ListToOpen } from './tool-navigation.js';

import type { AssistantTool, ToolContext } from './assistant-tool.js';
import type { Role } from '@ers/shared';
import type { ChatCompletionFunctionTool } from 'openai/resources/chat/completions';

/** Every tool the assistant has; each role gets the ones its permissions allow. */
export const TOOL_CLASSES: readonly Type<AssistantTool>[] = [
  SearchEventsTool,
  GetEventTool,
  SearchSessionsTool,
  SearchRegistrationsTool,
  SearchCustomersTool,
  ListTagsTool,
  SearchCatalogTool,
  SearchMyRegistrationsTool,
];

/**
 * What a tool run gives back: its data, or why it could not run. A search the model asked to show
 * also carries the list to open, or why it could not be opened, for the model to tell the user.
 */
export type ToolOutcome =
  { data: unknown; listToOpen?: ListToOpen; notShown?: string } | { error: string };

function definitionOf(tool: AssistantTool): ChatCompletionFunctionTool {
  const schema = z.toJSONSchema(tool.parameters) as Record<string, unknown>;
  // The model needs the schema itself, not the JSON Schema dialect it is written in.
  const parameters = Object.fromEntries(
    Object.entries(schema).filter(([key]) => key !== '$schema'),
  );
  return {
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters },
  };
}

/** The list a run opens, when its tool opens one and the model passed `show: true`. */
function shownList(tool: AssistantTool, args: unknown, timeZone: string) {
  const resource = tool.permission.resource;
  if (tool.listView === undefined || !isChatNavigableResource(resource)) return {};
  const values = args as Record<string, unknown>;
  if (values.show !== true) return {};
  const list = listToOpen(resource, values, { withoutDays: tool.listView.withoutDays, timeZone });
  return 'problem' in list ? { notShown: list.problem } : { listToOpen: list };
}

/**
 * Fails at startup when a tool's arguments and its list disagree: `show` belongs exactly to tools
 * that open a list, and every other argument of such a tool must be a filter of that list, so a
 * renamed argument cannot quietly drop out of the opened list.
 */
function assertListView(tool: AssistantTool): void {
  const schema = z.toJSONSchema(tool.parameters) as { properties?: Record<string, unknown> };
  const fields = Object.keys(schema.properties ?? {});
  const hasShow = fields.includes('show');
  if (hasShow !== (tool.listView !== undefined)) {
    throw new Error(`${tool.name}: a show argument goes with a listView, and only with one`);
  }
  if (tool.listView === undefined) return;
  const resource = tool.permission.resource;
  if (!isChatNavigableResource(resource)) {
    throw new Error(`${tool.name}: the ${resource} list cannot be opened from the chat`);
  }
  const filters = CHAT_NAVIGATION[resource];
  const strays = fields.filter((field) => field !== 'show' && !Object.hasOwn(filters, field));
  if (strays.length > 0) {
    throw new Error(`${tool.name}: ${strays.join(', ')} are not filters of the ${resource} list`);
  }
}

/**
 * The assistant's tools for one role, and running one of them for a user. The model only learns
 * of tools its role allows; a call to any other, with arguments that do not fit, or one the
 * service refuses, comes back as an error the model can read and correct.
 */
@Injectable()
export class ChatToolbox implements OnModuleInit {
  private tools: AssistantTool[] = [];

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    this.tools = TOOL_CLASSES.map((tool) => this.moduleRef.get(tool));
    this.tools.forEach(assertListView);
  }

  definitionsFor(role: Role): ChatCompletionFunctionTool[] {
    return this.allowedFor(role).map(definitionOf);
  }

  /** The progress text of a tool the role may use; undefined for any other name. */
  progressOf(name: string, role: Role): string | undefined {
    return this.allowedFor(role).find((tool) => tool.name === name)?.progress;
  }

  async run(name: string, rawArgs: unknown, context: ToolContext): Promise<ToolOutcome> {
    const tool = this.allowedFor(context.user.role).find((candidate) => candidate.name === name);
    if (tool === undefined) return { error: `There is no tool called ${name}.` };
    const args = tool.parameters.safeParse(rawArgs);
    if (!args.success) return { error: `Invalid arguments: ${z.prettifyError(args.error)}` };
    try {
      const data: unknown = await tool.run(args.data, context);
      return { data, ...shownList(tool, args.data, context.timeZone) };
    } catch (error) {
      // Recovered on purpose: an expected refusal (not found, not allowed) is the model's to read.
      if (error instanceof DomainError) return { error: error.message };
      throw error;
    }
  }

  private allowedFor(role: Role): AssistantTool[] {
    return this.tools.filter((tool) => can(role, tool.permission.resource, tool.permission.action));
  }
}
