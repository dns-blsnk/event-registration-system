import { API_PREFIX } from '@ers/shared';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/** The repo-root .env is the one the API reads too, so both sides agree on ports and origins. */
const ENV_DIR = '../..';
const DEFAULT_API_PORT = '3000';
const DEFAULT_ADMIN_ORIGIN = 'http://localhost:5173';

/** An unset or empty variable falls back to the default (an empty .env line means "not set"). */
function valueOr(value: string | undefined, fallback: string): string {
  return value === undefined || value === '' ? fallback : value;
}

// In development Vite forwards /api to the API, the same way Vercel rewrites do in production, so
// the session cookie is always first-party and the browser never makes cross-site API calls.
// The dev server listens on the port of ADMIN_ORIGIN, the origin the API's CORS and CSRF checks
// expect; open the admin at exactly that origin.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ENV_DIR, '');
  const adminOrigin = new URL(valueOr(env.ADMIN_ORIGIN, DEFAULT_ADMIN_ORIGIN));
  return {
    envDir: ENV_DIR,
    plugins: [react()],
    server: {
      host: adminOrigin.hostname,
      port: Number(adminOrigin.port),
      strictPort: true,
      proxy: {
        [`/${API_PREFIX}`]: {
          target: `http://localhost:${valueOr(env.API_PORT, DEFAULT_API_PORT)}`,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      include: ['src/**/*.spec.{ts,tsx}'],
      // Refine and MUI X import MUI by folder path, which only a bundler resolves, and must share one
      // react-router instance with the app; so Vite bundles them for tests just like for the browser.
      server: { deps: { inline: [/@refinedev\//, /@mui\/x-/, /react-router/] } },
    },
  };
});
