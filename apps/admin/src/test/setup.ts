import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import { authProvider } from '@/entities/viewer';

afterEach(async () => {
  // Vitest runs without globals, so Testing Library cannot register its own cleanup.
  cleanup();
  // The signed-in user is cached per module; a 401 is the public way to forget it between tests.
  await authProvider.onError({ statusCode: 401 });
  window.history.pushState({}, '', '/');
});
