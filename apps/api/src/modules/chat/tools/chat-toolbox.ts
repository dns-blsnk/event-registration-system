import { can } from '@ers/shared';
import { Injectable, type OnModuleInit, type Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { z } from 'zod';

import { DomainError } from '../../../common/errors/domain-error.js';

import { GetEventTool, SearchEventsTool } from './event-tools.js';
import {
  ListTagsTool,
  SearchCustomersTool,
  SearchRegistrationsTool,
  SearchSessionsTool,
} from './staff-tools.js';

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
];

/** What a tool run gives back to the model: its data, or why it could not run. */
export type ToolOutcome = { data: unknown } | { error: string };

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
  }

  definitionsFor(role: Role): ChatCompletionFunctionTool[] {
    return this.allowedFor(role).map(definitionOf);
  }

  async run(name: string, rawArgs: unknown, context: ToolContext): Promise<ToolOutcome> {
    const tool = this.allowedFor(context.user.role).find((candidate) => candidate.name === name);
    if (tool === undefined) return { error: `There is no tool called ${name}.` };
    const args = tool.parameters.safeParse(rawArgs);
    if (!args.success) return { error: `Invalid arguments: ${z.prettifyError(args.error)}` };
    try {
      return { data: await tool.run(args.data, context) };
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
