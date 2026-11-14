import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as reachable without a session. Every other route requires one. */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);
