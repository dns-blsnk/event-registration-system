import { describe, expect, it } from 'vitest';

import {
  DEMO_EMAILS,
  generateSeedPlan,
  groupBySession,
  type SeedPlan,
  type SeedSizes,
} from './generate.js';

const NOW = new Date('2026-11-14T12:00:00Z');
const SMALL: SeedSizes = {
  organizers: 4,
  customers: 60,
  events: 30,
  sessionsPerEvent: 4,
  registrations: 600,
  tags: 6,
};

const plan: SeedPlan = generateSeedPlan({ seed: 7, now: NOW, sizes: SMALL });
const sessionsById = new Map(plan.sessions.map((session) => [session.id, session]));
const eventsById = new Map(plan.events.map((event) => [event.id, event]));

describe('generateSeedPlan', () => {
  it('is deterministic for a seed', () => {
    expect(generateSeedPlan({ seed: 7, now: NOW, sizes: SMALL })).toEqual(plan);
  });

  it('creates one demo account per role plus the requested people', () => {
    const demo = plan.users.filter((user) => user.isDemo);

    expect(demo.map((user) => [user.email, user.role])).toEqual([
      [DEMO_EMAILS.admin, 'ADMIN'],
      [DEMO_EMAILS.organizer, 'ORGANIZER'],
      [DEMO_EMAILS.customer, 'CUSTOMER'],
    ]);
    expect(plan.users).toHaveLength(3 + SMALL.organizers + SMALL.customers);
  });

  it('gives every user a unique lowercase email', () => {
    const emails = plan.users.map((user) => user.email);

    expect(new Set(emails).size).toBe(emails.length);
    expect(emails.every((email) => email === email.toLowerCase())).toBe(true);
  });

  it('keeps every session inside its event and every slug unique', () => {
    for (const session of plan.sessions) {
      const event = eventsById.get(session.eventId);
      expect(event).toBeDefined();
      expect(
        session.startsAt >= (event?.startsAt ?? NOW) && session.endsAt <= (event?.endsAt ?? NOW),
      ).toBe(true);
    }
    expect(new Set(plan.events.map((event) => event.slug)).size).toBe(plan.events.length);
  });

  it('matches event statuses to time: completed only when over, drafts only in the future', () => {
    for (const event of plan.events) {
      if (event.status === 'COMPLETED') {
        expect(event.endsAt <= NOW).toBe(true);
      }
      if (event.status === 'DRAFT') {
        expect(event.startsAt > NOW).toBe(true);
      }
    }
  });

  it('never books a session twice for one customer', () => {
    const pairs = plan.registrations.map(
      (registration) => `${registration.sessionId}:${registration.customerId}`,
    );

    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('keeps seat counters exact and within capacity', () => {
    for (const session of plan.sessions) {
      const taken = plan.registrations.filter(
        (registration) =>
          registration.sessionId === session.id &&
          ['CONFIRMED', 'ATTENDED'].includes(registration.status),
      ).length;
      expect(session.confirmedCount).toBe(taken);
      expect(taken).toBeLessThanOrEqual(session.capacity);
    }
  });

  it('never gives a customer two overlapping confirmed seats', () => {
    const byCustomer = new Map<string, { startsAt: Date; endsAt: Date }[]>();
    for (const registration of plan.registrations) {
      if (!['CONFIRMED', 'ATTENDED'].includes(registration.status)) {
        continue;
      }
      const session = sessionsById.get(registration.sessionId);
      const taken = byCustomer.get(registration.customerId) ?? [];
      expect(
        taken.some(
          (other) =>
            session !== undefined &&
            other.startsAt < session.endsAt &&
            session.startsAt < other.endsAt,
        ),
      ).toBe(false);
      if (session !== undefined) {
        byCustomer.set(registration.customerId, [...taken, session]);
      }
    }
  });

  it('records attendance only for started sessions and waitlists only future ones', () => {
    for (const registration of plan.registrations) {
      const session = sessionsById.get(registration.sessionId);
      if (registration.status === 'ATTENDED') {
        expect((session?.startsAt ?? NOW) <= NOW).toBe(true);
      }
      if (registration.status === 'WAITLISTED') {
        expect((session?.startsAt ?? NOW) > NOW).toBe(true);
      }
    }
  });

  it('books only published, completed or cancelled events, and cancelled events only hold cancelled bookings', () => {
    for (const registration of plan.registrations) {
      const event = eventsById.get(sessionsById.get(registration.sessionId)?.eventId ?? '');
      expect(event?.status).not.toBe('DRAFT');
      if (event?.status === 'CANCELLED') {
        expect(registration.status).toBe('CANCELLED');
      }
    }
  });

  it('dates bookings before their session and never in the future', () => {
    for (const registration of plan.registrations) {
      const session = sessionsById.get(registration.sessionId);
      expect(registration.createdAt <= NOW).toBe(true);
      expect(registration.createdAt < (session?.startsAt ?? NOW)).toBe(true);
    }
  });

  it('dates waitlist places after the seats taken in the same session', () => {
    for (const booked of groupBySession(plan.registrations).values()) {
      const seats = booked.filter((registration) =>
        ['CONFIRMED', 'ATTENDED'].includes(registration.status),
      );
      const lastSeat = Math.max(
        0,
        ...seats.map((registration) => registration.createdAt.getTime()),
      );
      for (const waiting of booked.filter((registration) => registration.status === 'WAITLISTED')) {
        expect(waiting.createdAt.getTime()).toBeGreaterThanOrEqual(lastSeat);
      }
    }
  });

  it('creates every account, event and session before its bookings', () => {
    const usersById = new Map(plan.users.map((user) => [user.id, user]));
    for (const registration of plan.registrations) {
      const session = sessionsById.get(registration.sessionId);
      const event = eventsById.get(session?.eventId ?? '');
      expect(
        (usersById.get(registration.customerId)?.createdAt ?? NOW) < registration.createdAt,
      ).toBe(true);
      expect((event?.createdAt ?? NOW) < registration.createdAt).toBe(true);
      expect(session?.createdAt).toEqual(event?.createdAt);
    }
  });

  it('cancels all bookings of a cancelled event at one moment, after each was made', () => {
    for (const event of plan.events.filter((candidate) => candidate.status === 'CANCELLED')) {
      const booked = plan.registrations.filter(
        (registration) => sessionsById.get(registration.sessionId)?.eventId === event.id,
      );
      expect(
        new Set(booked.map((registration) => registration.cancelledAt?.getTime())).size,
      ).toBeLessThanOrEqual(1);
      for (const registration of booked) {
        expect((registration.cancelledAt ?? NOW) > registration.createdAt).toBe(true);
      }
    }
  });

  it('caps sessions per day so they never run past the event', () => {
    const crowded = generateSeedPlan({
      seed: 3,
      now: NOW,
      sizes: { ...SMALL, sessionsPerEvent: 20 },
    });
    const events = new Map(crowded.events.map((event) => [event.id, event]));

    for (const session of crowded.sessions) {
      expect(session.endsAt <= (events.get(session.eventId)?.endsAt ?? NOW)).toBe(true);
    }
  });

  it('returns no bookings when there is nothing to book', () => {
    expect(
      generateSeedPlan({ seed: 1, now: NOW, sizes: { ...SMALL, events: 0 } }).registrations,
    ).toEqual([]);
  });

  it('refuses more tags than it has names for', () => {
    expect(() => generateSeedPlan({ seed: 1, now: NOW, sizes: { ...SMALL, tags: 100 } })).toThrow(
      'tags are available',
    );
  });

  it('produces every registration status so filters have something to show', () => {
    expect(new Set(plan.registrations.map((registration) => registration.status))).toEqual(
      new Set(['CONFIRMED', 'WAITLISTED', 'CANCELLED', 'ATTENDED']),
    );
  });
});
