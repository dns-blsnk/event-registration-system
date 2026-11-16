import { ErrorCode } from '@ers/shared';

import { DomainError } from '../common/errors/domain-error.js';

import type { ChainableCommander } from 'ioredis';

/**
 * Runs a MULTI and fails if any command in it failed. ioredis reports a failed command inside a
 * transaction in the results instead of rejecting, which would otherwise pass silently.
 */
export async function execOrThrow(transaction: ChainableCommander): Promise<void> {
  const results = await transaction.exec();
  const failure = results?.find(([error]) => error !== null)?.[0];
  if (results === null || failure !== undefined) {
    throw (
      failure ?? new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Redis discarded the transaction')
    );
  }
}
