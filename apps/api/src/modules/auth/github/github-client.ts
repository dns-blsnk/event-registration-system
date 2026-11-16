import { ErrorCode } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../../common/errors/domain-error.js';
import { SECOND_MS } from '../../../common/time.js';
import { InjectConfig } from '../../../config/config.module.js';

import type { Config } from '../../../config/config.schema.js';

const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';
const EMAILS_URL = 'https://api.github.com/user/emails';
const REQUEST_TIMEOUT_SECONDS = 10;
const REQUEST_TIMEOUT_MS = REQUEST_TIMEOUT_SECONDS * SECOND_MS;

/** The parts of a GitHub account the API uses; the email is the primary one and is verified. */
export interface GithubProfile {
  id: string;
  name: string;
  email: string | undefined;
}

interface GithubUser {
  id?: unknown;
  login?: unknown;
  name?: unknown;
}

interface GithubEmail {
  email?: unknown;
  primary?: unknown;
  verified?: unknown;
}

function unavailable(reason: string, cause?: unknown): DomainError {
  const error = new DomainError(ErrorCode.SERVICE_UNAVAILABLE, `GitHub sign-in failed: ${reason}`);
  error.cause = cause;
  return error;
}

/** Talks to GitHub's OAuth and REST APIs. Its own class so tests replace it, not the network. */
@Injectable()
export class GithubClient {
  constructor(@InjectConfig() private readonly config: Config) {}

  /** Trades the one-time code (with its PKCE verifier) for an access token. */
  async exchangeCode(input: {
    code: string;
    verifier: string;
    redirectUri: string;
  }): Promise<string> {
    const github = this.config.github;
    if (github === undefined) throw unavailable('not configured');
    const body = (await this.send(TOKEN_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: github.clientId,
        client_secret: github.clientSecret,
        code: input.code,
        code_verifier: input.verifier,
        redirect_uri: input.redirectUri,
      }),
    })) as { access_token?: unknown };
    // GitHub answers 200 with an `error` field for a bad or reused code.
    if (typeof body.access_token !== 'string') throw unavailable('code was not accepted');
    return body.access_token;
  }

  async fetchProfile(accessToken: string): Promise<GithubProfile> {
    const init = {
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${accessToken}` },
    };
    const [user, emails] = (await Promise.all([
      this.send(USER_URL, init),
      this.send(EMAILS_URL, init),
    ])) as [GithubUser, unknown];
    if (typeof user.id !== 'number' && typeof user.id !== 'string') {
      throw unavailable('no account id');
    }
    const login = typeof user.login === 'string' ? user.login : '';
    const name =
      typeof user.name === 'string' && user.name.trim() !== '' ? user.name.trim() : login;
    const list = Array.isArray(emails) ? (emails as GithubEmail[]) : [];
    const primary = list.find((entry) => entry.primary === true && entry.verified === true);
    return {
      id: String(user.id),
      name,
      email: typeof primary?.email === 'string' ? primary.email : undefined,
    };
  }

  /** Any network failure, timeout, error status or non-JSON body becomes one "unavailable" error. */
  private async send(url: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      throw unavailable('GitHub could not be reached', error);
    }
    if (!response.ok) throw unavailable(`GitHub answered ${String(response.status)}`);
    try {
      return await response.json();
    } catch (error) {
      throw unavailable('GitHub sent an unreadable answer', error);
    }
  }
}
