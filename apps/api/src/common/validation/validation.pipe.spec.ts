import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { DomainError } from '../errors/domain-error.js';

import { createValidationPipe } from './validation.pipe.js';

class AddressDto {
  @IsString()
  city!: string;
}

class SampleDto {
  @IsEmail()
  email!: string;

  @IsInt()
  @Min(1)
  seats!: number;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;
}

async function validate(value: unknown): Promise<unknown> {
  return createValidationPipe().transform(value, { type: 'body', metatype: SampleDto });
}

async function failureOf(value: unknown): Promise<DomainError> {
  try {
    await validate(value);
  } catch (error) {
    if (error instanceof DomainError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected validation to fail');
}

describe('createValidationPipe', () => {
  it('passes a valid body and returns a DTO instance', async () => {
    const result = await validate({ email: 'a@b.co', seats: 2, address: { city: 'Kyiv' } });

    expect(result).toBeInstanceOf(SampleDto);
  });

  it('reports every invalid field with its messages', async () => {
    const error = await failureOf({ email: 'nope', seats: 0, address: { city: 'Kyiv' } });

    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.details?.map((detail) => detail.field)).toEqual(['email', 'seats']);
  });

  it('reports nested fields with a dotted path', async () => {
    const error = await failureOf({ email: 'a@b.co', seats: 1, address: { city: 5 } });

    expect(error.details).toEqual([{ field: 'address.city', messages: ['city must be a string'] }]);
  });

  it('rejects fields the DTO does not declare', async () => {
    const error = await failureOf({
      email: 'a@b.co',
      seats: 1,
      address: { city: 'Kyiv' },
      role: 'ADMIN',
    });

    expect(error.details).toEqual([
      { field: 'role', messages: ['property role should not exist'] },
    ]);
  });

  it('never echoes submitted values back in messages', async () => {
    const error = await failureOf({ email: 'leak@secret', seats: -5, address: { city: 'Kyiv' } });

    expect(JSON.stringify(error.details)).not.toContain('leak@secret');
  });
});
