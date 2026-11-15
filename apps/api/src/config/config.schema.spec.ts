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
    expect(config.redis).toEqual({ url: 'redis://localhost:6390', keyPrefix: 'ers:' });
  });

  it('accepts a TLS Redis URL and a custom key prefix', () => {
    const config = parseConfig(
      envWith({
        REDIS_URL: 'rediss://user:pass@kv.example.com:6380',
        REDIS_KEY_PREFIX: 'ers-e2e:',
      }),
    );

    expect(config.redis).toEqual({
      url: 'rediss://user:pass@kv.example.com:6380',
      keyPrefix: 'ers-e2e:',
    });
  });

  it('applies defaults for optional settings', () => {
    const config = parseConfig(
      envWith({ LOG_LEVEL: undefined, API_PORT: undefined, S3_FORCE_PATH_STYLE: undefined }),
    );

    expect(config.logLevel).toBe('info');
    expect(config.port).toBe(3000);
    expect(config.s3.forcePathStyle).toBe(false);
    expect(config.ai.model).toBe('gemini-3.5-flash-lite');
    expect(config.ai.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai/');
    expect(config.ai.reasoningEffort).toBe('low');
  });

  it('reports the build commit the host gives, and refuses one that is not a commit hash', () => {
    expect(parseConfig(envWith({ RENDER_GIT_COMMIT: 'a1b2c3d4e5f6' })).version).toBe(
      'a1b2c3d4e5f6',
    );
    expect(parseConfig(TEST_ENV).version).toBeUndefined();
    expect(configErrorFor(envWith({ RENDER_GIT_COMMIT: 'main; rm -rf' })).variables).toContain(
      'RENDER_GIT_COMMIT',
    );
  });

  it('listens on the host-given PORT unless API_PORT is set', () => {
    expect(parseConfig(envWith({ API_PORT: undefined, PORT: '10000' })).port).toBe(10000);
    expect(parseConfig(envWith({ API_PORT: '3100', PORT: '10000' })).port).toBe(3100);
  });

  it('reads an empty AI key as no key, so the chat reports itself unavailable', () => {
    expect(parseConfig(envWith({ AI_API_KEY: '' })).ai.apiKey).toBeUndefined();
  });

  it('treats blank values as unset so defaults still apply', () => {
    const config = parseConfig(
      envWith({
        LOG_LEVEL: '',
        API_PORT: ' ',
        S3_FORCE_PATH_STYLE: '',
        AI_MODEL: '',
        AI_BASE_URL: '',
        AI_REASONING_EFFORT: '',
      }),
    );

    expect(config.logLevel).toBe('info');
    expect(config.port).toBe(3000);
    expect(config.s3.forcePathStyle).toBe(false);
    expect(config.ai.model).toBe('gemini-3.5-flash-lite');
    expect(config.ai.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai/');
    expect(config.ai.reasoningEffort).toBe('low');
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
    const error = configErrorFor(
      envWith({ DATABASE_URL: undefined, REDIS_URL: undefined, SESSION_SECRET: undefined }),
    );

    expect(error.variables).toEqual(['DATABASE_URL', 'REDIS_URL', 'SESSION_SECRET']);
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
    ['AI_BASE_URL', 'ftp://ai.example.com/v1/'],
    ['AI_BASE_URL', 'not a url'],
    ['AI_REASONING_EFFORT', 'extreme'],
    ['REDIS_URL', 'http://localhost:6379'],
    ['REDIS_URL', 'localhost:6379'],
    ['REDIS_KEY_PREFIX', 'has spaces'],
    ['REDIS_KEY_PREFIX', 'x'.repeat(41)],
  ])('rejects invalid %s (%s)', (name, value) => {
    expect(configErrorFor(envWith({ [name]: value })).variables).toEqual([name]);
  });

  it('normalises the admin origin', () => {
    expect(
      parseConfig(envWith({ ADMIN_ORIGIN: 'https://admin.example.com/path/' })).adminOrigin,
    ).toBe('https://admin.example.com');
  });

  it('treats empty optional secrets as absent', () => {
    const config = parseConfig(envWith({ AI_API_KEY: '  ', GITHUB_CLIENT_ID: '' }));

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
