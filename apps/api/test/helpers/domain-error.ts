import { DomainError } from '../../src/common/errors/domain-error.js';

/** Runs `run` and returns the DomainError code it threw, 'OTHER' for any other error, or undefined. */
export function domainErrorCode(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof DomainError ? error.code : 'OTHER';
  }
  return undefined;
}
