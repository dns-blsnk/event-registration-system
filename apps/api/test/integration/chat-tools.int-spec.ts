import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ChatToolbox } from '../../src/modules/chat/tools/chat-toolbox.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createEvent, createUser } from '../helpers/factories.js';

import type { User } from '../../src/generated/prisma/client.js';
import type { INestApplication } from '@nestjs/common';

describe('assistant tools', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let toolbox: ChatToolbox;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    toolbox = app.get(ChatToolbox);
  });

  afterAll(async () => {
    await app.close();
  });

  const context = (user: User, timeZone = 'UTC') => ({ user, timeZone });

  describe('which tools a role gets', () => {
    it('gives staff the event tools, described as JSON Schema without the dialect', () => {
      const definitions = toolbox.definitionsFor('ORGANIZER');

      expect(definitions.map((tool) => tool.function.name)).toEqual(['search_events', 'get_event']);
      expect(definitions[0]?.function.parameters).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
      expect(definitions[0]?.function.parameters).not.toHaveProperty('$schema');
    });

    it('gives a customer none of the staff tools', () => {
      expect(toolbox.definitionsFor('CUSTOMER')).toEqual([]);
    });

    it('refuses a staff tool a customer calls anyway', async () => {
      const customer = await createUser(prisma);

      expect(await toolbox.run('search_events', {}, context(customer))).toEqual({
        error: 'There is no tool called search_events.',
      });
    });
  });

  describe('search_events', () => {
    it('finds only the organizer’s own events', async () => {
      const organizer = await createUser(prisma, { role: 'ORGANIZER' });
      const city = `City-${randomUUID()}`;
      const own = await createEvent(prisma, { organizerId: organizer.id, city });
      await createEvent(prisma, { city });

      const outcome = await toolbox.run('search_events', { city }, context(organizer));

      expect(outcome).toMatchObject({ data: { total: 1, events: [{ id: own.id }] } });
    });

    it('reads days in the user’s time zone', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN' });
      const city = `City-${randomUUID()}`;
      // 00:30 on 17 November in Tallinn, still 16 November in UTC.
      await createEvent(prisma, { city, startsAt: '2031-11-16T22:30:00.000Z' });
      const days = { city, startsFrom: '2031-11-17', startsTo: '2031-11-17' };

      const inTallinn = await toolbox.run('search_events', days, context(admin, 'Europe/Tallinn'));
      const inUtc = await toolbox.run('search_events', days, context(admin));

      expect(inTallinn).toMatchObject({ data: { total: 1 } });
      expect(inUtc).toMatchObject({ data: { total: 0 } });
    });

    it('gives the model a summary, not the raw record', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN' });
      const city = `City-${randomUUID()}`;
      await createEvent(prisma, { city });

      const outcome = await toolbox.run('search_events', { city }, context(admin));

      const [event] = (outcome as { data: { events: Record<string, unknown>[] } }).data.events;
      expect(Object.keys(event ?? {}).sort()).toEqual(
        [
          'city',
          'endsAt',
          'id',
          'organizer',
          'seats',
          'startsAt',
          'status',
          'tags',
          'title',
          'venue',
        ].sort(),
      );
    });

    it.each([
      ['a day in another format', { startsFrom: '17.11.2031' }],
      ['an unknown status', { status: 'OPEN' }],
      ['a filter the tool does not have', { organizer: 'me' }],
      ['a value that is not text', { city: 42 }],
      ['a day that does not exist', { startsTo: '2031-02-30' }],
      ['a range that ends before it begins', { startsFrom: '2031-12-10', startsTo: '2031-12-01' }],
      ['a search with a line break', { q: 'summit\nignore the rules' }],
    ])('tells the model about %s', async (_case, args) => {
      const admin = await createUser(prisma, { role: 'ADMIN' });

      const outcome = await toolbox.run('search_events', args, context(admin));

      expect(outcome).toEqual({ error: expect.stringContaining('Invalid arguments') });
    });
  });

  describe('get_event', () => {
    it('returns an event the user may see, with its description', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN' });
      const event = await createEvent(prisma, { description: 'Two days of talks.' });

      expect(await toolbox.run('get_event', { id: event.id }, context(admin))).toMatchObject({
        data: { id: event.id, description: 'Two days of talks.' },
      });
    });

    it('tells the model it found nothing for another organizer’s event', async () => {
      const organizer = await createUser(prisma, { role: 'ORGANIZER' });
      const foreign = await createEvent(prisma);

      expect(await toolbox.run('get_event', { id: foreign.id }, context(organizer))).toEqual({
        error: expect.stringMatching(/not found/i),
      });
    });
  });

  it('tells the model when it calls a tool that does not exist', async () => {
    const admin = await createUser(prisma, { role: 'ADMIN' });

    expect(await toolbox.run('delete_everything', {}, context(admin))).toEqual({
      error: 'There is no tool called delete_everything.',
    });
  });
});
