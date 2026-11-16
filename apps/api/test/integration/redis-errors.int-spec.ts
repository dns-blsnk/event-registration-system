import { createServer, type Server, type Socket } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { translateRedisError } from '../../src/common/errors/redis-errors.js';
import { parseConfig } from '../../src/config/config.schema.js';
import { RedisService } from '../../src/redis/redis.service.js';
import { silentLogger } from '../helpers/silent-logger.js';
import { DEAD_REDIS_URL, TEST_ENV } from '../helpers/test-env.js';

/** A port that accepts connections and never answers, like a Redis stuck behind a dead route. */
const SILENT_PORT = 6398;
const PENDING_SECONDS = 1;

function clientFor(url: string): RedisService {
  return new RedisService(parseConfig({ ...TEST_ENV, REDIS_URL: url }), silentLogger);
}

async function failureOf(command: Promise<unknown>): Promise<unknown> {
  return command.then(
    () => new Error('expected the command to fail'),
    (error: unknown) => error,
  );
}

/** The errors the real client throws, so a reworded message in a new ioredis version shows here. */
describe('Redis outages through the real client', () => {
  let silent: Server;
  const accepted: Socket[] = [];

  beforeAll(async () => {
    silent = createServer((socket) => {
      accepted.push(socket);
    });
    await new Promise<void>((resolve) => silent.listen(SILENT_PORT, resolve));
  });

  afterAll(async () => {
    for (const socket of accepted) socket.destroy();
    await new Promise((resolve) => silent.close(resolve));
  });

  it('answers 503 when nothing listens at the Redis address', async () => {
    const redis = clientFor(DEAD_REDIS_URL);

    const error = await failureOf(redis.get('key'));
    redis.disconnect();

    expect(translateRedisError(error)).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('answers 503 when Redis accepts the connection but never replies', async () => {
    const redis = clientFor(`redis://localhost:${String(SILENT_PORT)}`);

    const error = await failureOf(redis.get('key'));
    redis.disconnect();

    expect(translateRedisError(error)).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('answers 503 when the connection closes under a pending command', async () => {
    const redis = clientFor(TEST_ENV.REDIS_URL ?? '');
    await redis.ping();

    const pending = failureOf(redis.blpop('never-filled', PENDING_SECONDS));
    redis.disconnect();

    expect(translateRedisError(await pending)).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });
});
