import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ChatToolbox } from '../../src/modules/chat/tools/chat-toolbox.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp } from '../helpers/create-test-app.js';
import {
  createEvent,
  createRegistration,
  createSession,
  createUser,
} from '../helpers/factories.js';

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

      expect(definitions.map((tool) => tool.function.name)).toEqual([
        'search_events',
        'get_event',
        'search_sessions',
        'search_registrations',
        'search_customers',
        'list_tags',
      ]);
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

  describe('staff searches, scoped like the API', () => {
    it('finds only sessions of the organizer’s own events', async () => {
      const organizer = await createUser(prisma, { role: 'ORGANIZER' });
      const title = `Talk ${randomUUID()}`;
      const own = await createSession(
        prisma,
        await createEvent(prisma, { organizerId: organizer.id }),
        {
          title,
        },
      );
      await createSession(prisma, await createEvent(prisma), { title });

      const outcome = await toolbox.run('search_sessions', { q: title }, context(organizer));

      expect(outcome).toMatchObject({ data: { total: 1, sessions: [{ id: own.id, title }] } });
    });

    it('finds bookings only for the organizer’s own events, without customer emails', async () => {
      const organizer = await createUser(prisma, { role: 'ORGANIZER' });
      const ownEvent = await createEvent(prisma, { organizerId: organizer.id });
      const booker = await createUser(prisma);
      const own = await createRegistration(prisma, await createSession(prisma, ownEvent), {
        customerId: booker.id,
      });
      await createRegistration(prisma, await createSession(prisma, await createEvent(prisma)));

      const outcome = await toolbox.run(
        'search_registrations',
        { eventId: ownEvent.id },
        context(organizer),
      );

      expect(outcome).toMatchObject({ data: { total: 1, registrations: [{ id: own.id }] } });
      expect(JSON.stringify(outcome)).not.toContain(booker.email);
    });

    it('returns no bookings of another organizer’s event, even by its id', async () => {
      const organizer = await createUser(prisma, { role: 'ORGANIZER' });
      const foreign = await createEvent(prisma);
      await createRegistration(prisma, await createSession(prisma, foreign));

      const outcome = await toolbox.run(
        'search_registrations',
        { eventId: foreign.id },
        context(organizer),
      );

      expect(outcome).toMatchObject({ data: { total: 0 } });
    });

    it('finds customers by name and gives no emails', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN' });
      const name = `Ann ${randomUUID()}`;
      const customer = await createUser(prisma, { name });
      await createRegistration(prisma, await createSession(prisma, await createEvent(prisma)), {
        customerId: customer.id,
      });

      const outcome = await toolbox.run('search_customers', { q: name }, context(admin));

      expect(outcome).toMatchObject({ data: { total: 1, customers: [{ id: customer.id, name }] } });
      expect(JSON.stringify(outcome)).not.toContain(customer.email);
    });

    it('finds only customers who booked the organizer’s own events', async () => {
      const organizer = await createUser(prisma, { role: 'ORGANIZER' });
      const name = `Bea ${randomUUID()}`;
      const ownCustomer = await createUser(prisma, { name });
      const otherCustomer = await createUser(prisma, { name });
      const ownEvent = await createEvent(prisma, { organizerId: organizer.id });
      await createRegistration(prisma, await createSession(prisma, ownEvent), {
        customerId: ownCustomer.id,
      });
      await createRegistration(prisma, await createSession(prisma, await createEvent(prisma)), {
        customerId: otherCustomer.id,
      });

      const outcome = await toolbox.run('search_customers', { q: name }, context(organizer));

      expect(outcome).toMatchObject({ data: { total: 1, customers: [{ id: ownCustomer.id }] } });
    });

    it('searches only upcoming sessions when no days are given', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN' });
      const title = `Talk ${randomUUID()}`;
      const event = await createEvent(prisma);
      const upcoming = await createSession(prisma, event, {
        title,
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
      await createSession(prisma, event, {
        title,
        startsAt: new Date(Date.now() - 86_400_000).toISOString(),
      });

      const outcome = await toolbox.run('search_sessions', { q: title }, context(admin));

      expect(outcome).toMatchObject({ data: { total: 1, sessions: [{ id: upcoming.id }] } });
    });

    it('finds almost full sessions', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN' });
      const title = `Talk ${randomUUID()}`;
      const event = await createEvent(prisma);
      const full = await createSession(prisma, event, { title, capacity: 10, confirmedCount: 10 });
      await createSession(prisma, event, { title, capacity: 10, confirmedCount: 1 });

      const outcome = await toolbox.run(
        'search_sessions',
        { q: title, almostFull: true },
        context(admin),
      );

      expect(outcome).toMatchObject({ data: { total: 1, sessions: [{ id: full.id }] } });
    });

    it.each([
      ['search_sessions', { almostFull: 'yes' }],
      ['search_registrations', { status: 'BOOKED' }],
      ['search_customers', { email: 'a@b.co' }],
      ['list_tags', { q: '' }],
    ])('tells the model about invalid arguments to %s', async (name, args) => {
      const admin = await createUser(prisma, { role: 'ADMIN' });

      expect(await toolbox.run(name, args, context(admin))).toEqual({
        error: expect.stringContaining('Invalid arguments'),
      });
    });

    it('lists tags with their ids for filtering events', async () => {
      const admin = await createUser(prisma, { role: 'ADMIN' });
      const name = `tag-${randomUUID()}`;
      const tag = await prisma.tag.create({ data: { name } });

      const outcome = await toolbox.run('list_tags', { q: name }, context(admin));

      expect(outcome).toEqual({ data: { total: 1, tags: [{ id: tag.id, name }] } });
    });
  });

  it('tells the model when it calls a tool that does not exist', async () => {
    const admin = await createUser(prisma, { role: 'ADMIN' });

    expect(await toolbox.run('delete_everything', {}, context(admin))).toEqual({
      error: 'There is no tool called delete_everything.',
    });
  });
});
