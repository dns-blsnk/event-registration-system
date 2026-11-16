import { describe, expect, it } from 'vitest';

import { blocker, reachabilityOf, starterQuestions, type ChatAvailability } from './chat-state';

const LOADING: ChatAvailability = { isLoaded: false, isFailed: false, isAvailable: false };
const FAILED: ChatAvailability = { isLoaded: false, isFailed: true, isAvailable: false };
const OFF: ChatAvailability = { isLoaded: true, isFailed: false, isAvailable: false };
const ON: ChatAvailability = { isLoaded: true, isFailed: false, isAvailable: true };

describe('reachabilityOf', () => {
  it('is connecting while the status check runs', () => {
    expect(reachabilityOf(LOADING, 'connecting')).toBe('connecting');
  });

  it('is unavailable when the status check failed, not connecting', () => {
    expect(reachabilityOf(FAILED, 'connecting')).toBe('unavailable');
  });

  it('is unavailable without a model', () => {
    expect(reachabilityOf(OFF, 'online')).toBe('unavailable');
  });

  it.each(['online', 'connecting', 'offline'] as const)(
    'follows the socket (%s) once the model is available',
    (connection) => {
      expect(reachabilityOf(ON, connection)).toBe(connection);
    },
  );
});

describe('blocker', () => {
  it('explains a failed check and a missing model', () => {
    expect(blocker(FAILED)).toMatch(/Could not reach/);
    expect(blocker(OFF)).toBe('The assistant is not available right now.');
  });

  it('lets the user ask on any page once the model is available, or while the check runs', () => {
    expect(blocker(ON)).toBeUndefined();
    expect(blocker(LOADING)).toBeUndefined();
  });
});

describe('starterQuestions', () => {
  it('asks about the focused field when there is one', () => {
    expect(starterQuestions('ADMIN', 'Capacity')[0]).toBe('What does “Capacity” mean?');
  });

  it('offers searches the role can run, and nothing before the role is known', () => {
    expect(starterQuestions('CUSTOMER', undefined)).toContain('Show my upcoming bookings');
    expect(starterQuestions('ORGANIZER', undefined)).toContain(
      'Which of my sessions are almost full?',
    );
    expect(starterQuestions('ADMIN', undefined)).toContain('Which sessions are almost full?');
    expect(starterQuestions('SUPER_ADMIN', undefined)).toEqual(
      starterQuestions('ADMIN', undefined),
    );
    expect(starterQuestions(undefined, undefined)).toEqual([]);
  });
});
