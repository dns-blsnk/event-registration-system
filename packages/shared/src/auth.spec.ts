import { describe, expect, it } from 'vitest';

import { GITHUB_SIGN_IN_ERRORS, isGithubSignInError } from './auth.js';

describe('isGithubSignInError', () => {
  it('accepts every known GitHub sign-in error', () => {
    for (const error of Object.keys(GITHUB_SIGN_IN_ERRORS)) {
      expect(isGithubSignInError(error)).toBe(true);
    }
  });

  it('rejects unknown values, so the sign-in page never shows text from the URL', () => {
    expect(isGithubSignInError('<script>')).toBe(false);
    expect(isGithubSignInError('toString')).toBe(false);
    expect(isGithubSignInError(undefined)).toBe(false);
    expect(isGithubSignInError(['failed'])).toBe(false);
  });
});
