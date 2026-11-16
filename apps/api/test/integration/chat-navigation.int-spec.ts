import { randomUUID } from 'node:crypto';

import {
  CHAT_NAVIGATION,
  Resource,
  type ChatFilterKind,
  type ChatNavigableResource,
  type Role,
} from '@ers/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { signedInAgent, type SignedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';

import type { INestApplication } from '@nestjs/common';

/** A role that may open each list the assistant can open. */
const ROLE_FOR: Readonly<Record<ChatNavigableResource, Role>> = {
  [Resource.EVENTS]: 'ADMIN',
  [Resource.SESSIONS]: 'ADMIN',
  [Resource.REGISTRATIONS]: 'ADMIN',
  [Resource.CUSTOMERS]: 'ADMIN',
  [Resource.CATALOG]: 'CUSTOMER',
  [Resource.MY_REGISTRATIONS]: 'CUSTOMER',
};

function sampleOf(filter: ChatFilterKind): string {
  switch (filter.kind) {
    case 'text':
      return 'summit';
    case 'day':
      return '2026-11-16';
    case 'uuid':
      return randomUUID();
    case 'enum':
      return filter.values[0] ?? '';
  }
}

const cases = Object.entries(CHAT_NAVIGATION).flatMap(([resource, filters]) =>
  Object.entries(filters as Record<string, ChatFilterKind>).map(
    ([field, filter]) => [resource as ChatNavigableResource, field, sampleOf(filter)] as const,
  ),
);

/** The assistant may only set filters the list endpoints really take; this keeps the two in step. */
describe('chat navigation filters against the list endpoints', () => {
  let app: INestApplication;
  const agents = new Map<Role, SignedInAgent>();

  beforeAll(async () => {
    app = await createTestApp();
    for (const role of new Set(Object.values(ROLE_FOR))) {
      agents.set(role, await signedInAgent(app, role));
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(cases)('GET /api/%s accepts the %s filter', async (resource, field, value) => {
    const agent = agents.get(ROLE_FOR[resource]);

    const response = await agent?.agent.get(`/api/${resource}`).query({ [field]: value });

    expect(response?.status).toBe(200);
  });
});
