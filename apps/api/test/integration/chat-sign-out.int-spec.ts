import { CSRF_HEADER, type Role } from '@ers/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ChatHistoryStore, type ChatOwner } from '../../src/modules/chat/chat-history.store.js';
import { signedInAgent, TEST_PASSWORD, type SignedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';

import type { INestApplication } from '@nestjs/common';

/** Chats may hold what a role could see, so they go when the user's sessions do. */
describe('chats when a user signs out or changes role', () => {
  let app: INestApplication;
  let store: ChatHistoryStore;
  let admin: SignedInAgent;

  beforeAll(async () => {
    app = await createTestApp();
    store = app.get(ChatHistoryStore);
    admin = await signedInAgent(app, 'SUPER_ADMIN');
  });

  afterAll(async () => {
    await app.close();
  });

  async function chatOf(owner: ChatOwner): Promise<string> {
    const chatId = await store.create(owner);
    await store.append(owner, chatId, [{ role: 'user', content: 'Events in Tallinn?' }]);
    return chatId;
  }

  function ownerOf(agent: SignedInAgent, role: Role): ChatOwner {
    return { userId: agent.userId, role };
  }

  it('forgets the user’s chats on sign-out', async () => {
    const customer = await signedInAgent(app, 'CUSTOMER');
    const chatId = await chatOf(ownerOf(customer, 'CUSTOMER'));

    await customer.agent.post('/api/auth/logout').set(CSRF_HEADER, customer.csrfToken).expect(204);

    expect(await store.load(ownerOf(customer, 'CUSTOMER'), chatId)).toBeUndefined();
  });

  it('forgets the user’s chats when their role changes', async () => {
    const organizer = await signedInAgent(app, 'ORGANIZER');
    const chatId = await chatOf(ownerOf(organizer, 'ORGANIZER'));

    await admin.agent
      .patch(`/api/users/${organizer.userId}`)
      .set(CSRF_HEADER, admin.csrfToken)
      .send({ role: 'CUSTOMER' })
      .expect(200);

    expect(await store.load(ownerOf(organizer, 'ORGANIZER'), chatId)).toBeUndefined();
  });

  it('forgets the user’s chats when the account is deleted', async () => {
    const customer = await signedInAgent(app, 'CUSTOMER');
    const chatId = await chatOf(ownerOf(customer, 'CUSTOMER'));

    await admin.agent
      .delete(`/api/users/${customer.userId}`)
      .set(CSRF_HEADER, admin.csrfToken)
      .expect(204);

    expect(await store.load(ownerOf(customer, 'CUSTOMER'), chatId)).toBeUndefined();
  });

  it('keeps other users’ chats', async () => {
    const leaving = await signedInAgent(app, 'CUSTOMER');
    const staying = await signedInAgent(app, 'CUSTOMER');
    const kept = await chatOf(ownerOf(staying, 'CUSTOMER'));

    await leaving.agent.post('/api/auth/logout').set(CSRF_HEADER, leaving.csrfToken).expect(204);

    expect(await store.load(ownerOf(staying, 'CUSTOMER'), kept)).toHaveLength(1);
  });

  it('keeps the user’s chats when they sign in again over an old session', async () => {
    const customer = await signedInAgent(app, 'CUSTOMER');
    const chatId = await chatOf(ownerOf(customer, 'CUSTOMER'));

    await customer.agent
      .post('/api/auth/login')
      .send({ email: customer.email, password: TEST_PASSWORD })
      .expect(200);

    expect(await store.load(ownerOf(customer, 'CUSTOMER'), chatId)).toHaveLength(1);
  });
});
