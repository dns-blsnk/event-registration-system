import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const SKIP_CSRF_TOKEN_KEY = 'skipCsrfToken';

/**
 * For login and sign-up only: they start a new session, so they cannot require the token of
 * whatever session the browser had. The Origin check in CsrfGuard still applies.
 */
export const SkipCsrfToken = (): CustomDecorator => SetMetadata(SKIP_CSRF_TOKEN_KEY, true);
