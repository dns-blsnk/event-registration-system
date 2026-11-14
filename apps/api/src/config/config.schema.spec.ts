import { describe, expect, it } from 'vitest';

import { TEST_ENV } from '../../test/helpers/test-env.js';

import { ConfigError, parseConfig } from './config.schema.js';

function envWith(
  overrides: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return { ...TEST_ENV, ...overrides };
}

function configErrorFor(env: Record<string, string | undefined>): ConfigError {
  try {
    parseConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected parseConfig to throw');
}

describe('parseConfig', () => {
  it('maps a complete environment to typed config', () => {
    const config = parseConfig(TEST_ENV);

    expect(config.nodeEnv).toBe('test');
    expect(config.isProduction).toBe(false);
    expect(config.port).toBe(3000);
    expect(config.adminOrigin).toBe('http://localhost:5173');
    expect(config.s3).toEqual({
      endpoint: 'http://localhost:8333',
      region: 'auto',
      bucket: 'ers-uploads-test',
      accessKeyId: 'ers_local_key',
      secretAccessKey: 'ers_local_only_secret',
      forcePathStyle: true,
    });
  });

  it('applies defaults for optional settings', () => {
    const config = parseConfig(
      envWith({ LOG_LEVEL: undefined, API_PORT: undefined, S3_FORCE_PATH_STYLE: undefined }),
    );

    expect(config.logLevel).toBe('info');
    expect(config.port).toBe(3000);
    expect(config.s3.forcePathStyle).toBe(false);
    expect(config.ai.model).toBe('claude-haiku-5-5');
  });

  it('reads an empty Anthropic key as no key, so the chat reports itself unavailable', () => {
    expect(parseConfig(envWith({ ANTHROPIC_API_KEY: '' })).ai.apiKey).toBeUndefined();
  });

  it('treats blank values as unset so defaults still apply', () => {
    const config = parseConfig(
      envWith({ LOG_LEVEL: '', API_PORT: ' ', S3_FORCE_PATH_STYLE: '', ANTHROPIC_MODEL: '' }),
    );

    expect(config.logLevel).toBe('info');
    expect(config.port).toBe(3000);
    expect(config.s3.forcePathStyle).toBe(false);
    expect(config.ai.model).toBe('claude-haiku-5-5');
  });

  it('requires NODE_ENV so a deploy never silently runs as development', () => {
    expect(configErrorFor(envWith({ NODE_ENV: undefined })).variables).toEqual(['NODE_ENV']);
  });

  it('flags production mode', () => {
    expect(
      parseConfig(envWith({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '1' })).isProduction,
    ).toBe(true);
  });

  it('requires trusted proxy hops in production so client IPs are real', () => {
    expect(configErrorFor(envWith({ NODE_ENV: 'production' })).variables).toEqual([
      'TRUST_PROXY_HOPS',
    ]);
  });

  it('lists every missing required variable by name', () => {
    const error = configErrorFor(envWith({ DATABASE_URL: undefined, SESSION_SECRET: undefined }));

    expect(error.variables).toEqual(['DATABASE_URL', 'SESSION_SECRET']);
  });

  it('never includes variable values in the error message', () => {
    const error = configErrorFor(envWith({ SESSION_SECRET: 'too-short-secret' }));

    expect(error.message).not.toContain('too-short-secret');
    expect(error.variables).toEqual(['SESSION_SECRET']);
  });

  it.each([
    ['ADMIN_ORIGIN', 'not-a-url'],
    ['DATABASE_URL', 'localhost'],
    ['API_PORT', '-1'],
    ['NODE_ENV', 'staging'],
    ['S3_FORCE_PATH_STYLE', 'yes'],
    ['API_PORT', '70000'],
    ['ADMIN_ORIGIN', 'file:///tmp/admin'],
    ['ADMIN_ORIGIN', 'mailto:admin@example.com'],
    ['DATABASE_URL', 'http://localhost:5442/ers'],
    ['S3_ENDPOINT', 'ftp://localhost:8333'],
  ])('rejects invalid %s (%s)', (name, value) => {
    expect(configErrorFor(envWith({ [name]: value })).variables).toEqual([name]);
  });

  it('normalises the admin origin', () => {
    expect(
      parseConfig(envWith({ ADMIN_ORIGIN: 'https://admin.example.com/path/' })).adminOrigin,
    ).toBe('https://admin.example.com');
  });

  it('treats empty optional secrets as absent', () => {
    const config = parseConfig(envWith({ ANTHROPIC_API_KEY: '  ', GITHUB_CLIENT_ID: '' }));

    expect(config.ai.apiKey).toBeUndefined();
    expect(config.github).toBeUndefined();
  });

  it('enables GitHub OAuth only when both id and secret are set', () => {
    expect(parseConfig(envWith({ GITHUB_CLIENT_ID: 'id' })).github).toBeUndefined();
    expect(
      parseConfig(envWith({ GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' })).github,
    ).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
    });
  });
});
