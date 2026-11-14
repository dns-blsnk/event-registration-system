import { IsString } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { DomainError } from '../errors/domain-error.js';

import { OptionalField } from './optional.js';
import { createValidationPipe } from './validation.pipe.js';

class Sample {
  @OptionalField()
  @IsString()
  name?: string;
}

async function fieldsRejected(value: unknown): Promise<string[]> {
  try {
    await createValidationPipe().transform(value, { type: 'body', metatype: Sample });
    return [];
  } catch (error) {
    return error instanceof DomainError
      ? (error.details ?? []).map((detail) => detail.field)
      : ['OTHER'];
  }
}

describe('OptionalField', () => {
  it('lets the field be left out', async () => {
    expect(await fieldsRejected({})).toEqual([]);
  });

  it('validates a present value', async () => {
    expect(await fieldsRejected({ name: 'ok' })).toEqual([]);
    expect(await fieldsRejected({ name: 5 })).toEqual(['name']);
  });

  it('rejects an explicit null', async () => {
    expect(await fieldsRejected({ name: null })).toEqual(['name']);
  });
});
