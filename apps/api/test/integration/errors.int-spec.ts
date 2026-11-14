import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ErrorsFixtureController } from '../fixtures/errors-fixture.controller.js';
import { createTestApp } from '../helpers/create-test-app.js';

import type { INestApplication } from '@nestjs/common';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('error responses', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [ErrorsFixtureController] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the request id in the header and in the error body', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/test-errors/conflict')
      .expect(409);

    expect(response.headers['x-request-id']).toMatch(UUID);
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });

  it('ignores a client-supplied request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/test-errors/conflict')
      .set('x-request-id', 'forged-id');

    expect(response.headers['x-request-id']).not.toBe('forged-id');
    expect(response.body.requestId).not.toBe('forged-id');
  });

  it('returns domain errors with their code and message', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/test-errors/conflict')
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Email is already taken',
    });
  });

  it('hides unexpected errors behind a generic 500', async () => {
    const response = await request(app.getHttpServer()).get('/api/test-errors/crash').expect(500);

    expect(response.body).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
    expect(response.body).not.toHaveProperty('stack');
  });

  it('returns field-level validation errors', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/test-errors/validate')
      .send({ email: 'not-an-email' })
      .expect(400);

    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [{ field: 'email', messages: ['email must be an email'] }],
    });
  });

  it('rejects unknown body fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/test-errors/validate')
      .send({ email: 'a@b.co', role: 'ADMIN' })
      .expect(400);

    expect(response.body.details).toEqual([
      { field: 'role', messages: ['property role should not exist'] },
    ]);
  });

  it('accepts a valid body', async () => {
    await request(app.getHttpServer())
      .post('/api/test-errors/validate')
      .send({ email: 'a@b.co' })
      .expect(201);
  });

  it('answers malformed JSON with a request id and without echoing the body', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/test-errors/validate')
      .set('Content-Type', 'application/json')
      .send('{"password":"hunter2')
      .expect(400);

    expect(response.body).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Request body is not valid JSON',
    });
    expect(response.body.requestId).toMatch(UUID);
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
  });

  it('rejects an oversized body with PAYLOAD_TOO_LARGE', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/test-errors/validate')
      .send({ email: 'a'.repeat(200_000) })
      .expect(413);

    expect(response.body).toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
      requestId: expect.stringMatching(UUID),
    });
  });

  it('formats unknown routes as NOT_FOUND', async () => {
    const response = await request(app.getHttpServer()).get('/api/nope').expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      requestId: expect.stringMatching(UUID),
    });
  });
});
