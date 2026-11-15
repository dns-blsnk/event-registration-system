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
  it('explains a failed check, a missing model and a missing screen', () => {
    expect(blocker(FAILED, true)).toMatch(/Could not reach/);
    expect(blocker(OFF, true)).toBe('The assistant is not available right now.');
    expect(blocker(ON, false)).toBe('Open a screen to ask about its fields.');
  });

  it('lets the user ask on a screen with the model available', () => {
    expect(blocker(ON, true)).toBeUndefined();
  });
});

describe('starterQuestions', () => {
  it('asks about the focused field, or about the screen without one', () => {
    expect(starterQuestions('Capacity')[0]).toBe('What does “Capacity” mean?');
    expect(starterQuestions(undefined)[0]).toBe('What can I do on this screen?');
  });
});
