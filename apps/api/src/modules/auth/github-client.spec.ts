import { ErrorCode } from '@ers/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../common/errors/domain-error.js';

import { GithubClient } from './github-client.js';

import type { Config } from '../../config/config.schema.js';

const CONFIGURED = { github: { clientId: 'client-id', clientSecret: 'client-secret' } } as Config;
const RETURN = { code: 'the-code', verifier: 'the-verifier', redirectUri: 'http://x/cb' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Answers the user and emails endpoints with the given bodies. */
function githubApi(user: unknown, emails: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => Promise.resolve(json(url.endsWith('/emails') ? emails : user))),
  );
}

async function failure(promise: Promise<unknown>): Promise<DomainError> {
  const error: unknown = await promise.catch((caught: unknown) => caught);
  if (!(error instanceof DomainError)) throw new Error('expected a DomainError');
  return error;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GithubClient.exchangeCode', () => {
  it('sends the code, verifier and callback with the client credentials and returns the token', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json({ access_token: 'gho_token' })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(new GithubClient(CONFIGURED).exchangeCode(RETURN)).resolves.toBe('gho_token');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://github.com/login/oauth/access_token');
    expect(JSON.parse(init.body as string)).toEqual({
      client_id: 'client-id',
      client_secret: 'client-secret',
      code: 'the-code',
      code_verifier: 'the-verifier',
      redirect_uri: 'http://x/cb',
    });
  });

  it('fails as unavailable when GitHub does not accept the code', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(json({ error: 'bad_verification_code' })));

    const error = await failure(new GithubClient(CONFIGURED).exchangeCode(RETURN));

    expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
  });

  it('fails as unavailable, keeping the cause, when GitHub cannot be reached', async () => {
    const networkError = new TypeError('fetch failed');
    vi.stubGlobal('fetch', () => Promise.reject(networkError));

    const error = await failure(new GithubClient(CONFIGURED).exchangeCode(RETURN));

    expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    expect(error.cause).toBe(networkError);
  });

  it('fails as unavailable on an error status or an unreadable body', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(json({}, 502)));
    expect((await failure(new GithubClient(CONFIGURED).exchangeCode(RETURN))).code).toBe(
      ErrorCode.SERVICE_UNAVAILABLE,
    );

    vi.stubGlobal('fetch', () => Promise.resolve(new Response('<html>')));
    expect((await failure(new GithubClient(CONFIGURED).exchangeCode(RETURN))).code).toBe(
      ErrorCode.SERVICE_UNAVAILABLE,
    );
  });

  it('fails without calling GitHub when GitHub sign-in is not configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await failure(new GithubClient({ github: undefined } as Config).exchangeCode(RETURN));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GithubClient.fetchProfile', () => {
  it('returns the account id, name and the verified primary email', async () => {
    githubApi({ id: 42, login: 'anna', name: 'Anna K' }, [
      { email: 'old@example.com', primary: false, verified: true },
      { email: 'anna@example.com', primary: true, verified: true },
    ]);

    await expect(new GithubClient(CONFIGURED).fetchProfile('t')).resolves.toEqual({
      id: '42',
      name: 'Anna K',
      email: 'anna@example.com',
    });
  });

  it('uses the login as the name when the account has none', async () => {
    githubApi({ id: 42, login: 'anna', name: null }, []);

    expect((await new GithubClient(CONFIGURED).fetchProfile('t')).name).toBe('anna');
  });

  it('reports no email when the primary email is not verified', async () => {
    githubApi({ id: 42, login: 'anna' }, [
      { email: 'anna@example.com', primary: true, verified: false },
    ]);

    expect((await new GithubClient(CONFIGURED).fetchProfile('t')).email).toBeUndefined();
  });

  it('sends the access token as a bearer token', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json({ id: 1, login: 'a' })));
    vi.stubGlobal('fetch', fetchMock);

    await new GithubClient(CONFIGURED).fetchProfile('gho_token');

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ authorization: 'Bearer gho_token' });
  });

  it('fails as unavailable when GitHub returns no account id', async () => {
    githubApi({ login: 'anna' }, []);

    const error = await failure(new GithubClient(CONFIGURED).fetchProfile('t'));

    expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
  });
});
