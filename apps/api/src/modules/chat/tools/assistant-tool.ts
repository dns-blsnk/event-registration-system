import type { User } from '../../../generated/prisma/client.js';
import type { WithoutDays } from './tool-filters.js';
import type { Action, Resource } from '@ers/shared';
import type { z } from 'zod';

/** What every tool run knows: who asks (with their current role) and in which time zone. */
export interface ToolContext {
  user: User;
  timeZone: string;
}

/**
 * One thing the assistant can do for the user: a name and description the model reads, the
 * arguments it may pass (checked before the run), and the permission the user needs. A tool only
 * reads, through the same services and scoping as the REST API.
 */
export interface AssistantTool<TSchema extends z.ZodType = z.ZodType> {
  readonly name: string;
  readonly description: string;
  readonly parameters: TSchema;
  readonly permission: { resource: Resource; action: Action };
  /**
   * Set on a search that can open its list (the permission's resource) with its own filters when
   * the model passes `show: true`. `withoutDays` is what the search covers when no day is given,
   * so the opened list covers the same.
   */
  readonly listView?: { readonly withoutDays: WithoutDays };
  run(args: z.infer<TSchema>, context: ToolContext): Promise<unknown>;
}

/** Results are capped: enough for an answer, small enough to keep the model's context short. */
export const TOOL_PAGE_SIZE = 20;
/** Said in every search tool's description, so the model knows a list may be cut. */
export const UP_TO_A_PAGE = `Returns at most ${String(TOOL_PAGE_SIZE)} and the total count.`;
