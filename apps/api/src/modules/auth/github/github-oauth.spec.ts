import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { startGithubAuthorization, verifyGithubReturn } from './github-oauth.js';

const REDIRECT_URI = 'http://localhost:5173/api/auth/github/callback';

function started(): { params: URLSearchParams; state: string; verifier: string; url: URL } {
  const { url, cookieValue } = startGithubAuthorization('client-id', REDIRECT_URI);
  const [state = '', verifier = ''] = cookieValue.split('.');
  const parsed = new URL(url);
  return { params: parsed.searchParams, state, verifier, url: parsed };
}

describe('startGithubAuthorization', () => {
  it('sends the browser to GitHub with the client id, callback and read-only scopes', () => {
    const { url, params } = started();

    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(params.get('client_id')).toBe('client-id');
    expect(params.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(params.get('scope')).toBe('read:user user:email');
  });

  it('puts the state in the URL and keeps it, with the verifier, for the cookie', () => {
    const { params, state, verifier } = started();

    expect(params.get('state')).toBe(state);
    expect(state.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('sends only the S256 challenge of the verifier, never the verifier itself', () => {
    const { params, verifier, url } = started();

    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).toBe(
      createHash('sha256').update(verifier).digest('base64url'),
    );
    expect(url.toString()).not.toContain(verifier);
  });

  it('uses a fresh state and verifier for every sign-in', () => {
    expect(started().state).not.toBe(started().state);
    expect(started().verifier).not.toBe(started().verifier);
  });
});

describe('verifyGithubReturn', () => {
  it('gives the verifier back when the returned state matches the cookie', () => {
    expect(verifyGithubReturn('the-state.the-verifier', 'the-state')).toBe('the-verifier');
  });

  it('refuses a state that does not match the cookie (login CSRF)', () => {
    expect(verifyGithubReturn('the-state.the-verifier', 'other-state')).toBeUndefined();
  });

  it('refuses a return with no cookie or no state', () => {
    expect(verifyGithubReturn(undefined, 'the-state')).toBeUndefined();
    expect(verifyGithubReturn('the-state.the-verifier', undefined)).toBeUndefined();
  });

  it('refuses a repeated state parameter', () => {
    expect(verifyGithubReturn('the-state.the-verifier', ['the-state', 'x'])).toBeUndefined();
  });

  it('refuses a malformed cookie', () => {
    expect(verifyGithubReturn('only-state', 'only-state')).toBeUndefined();
    expect(verifyGithubReturn('a.b.c', 'a')).toBeUndefined();
  });
});
