import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emits decorator metadata, which Nest dependency injection needs.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.spec.ts', 'prisma/seed/**/*.spec.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          // All files share one test database, so they run one after another.
          fileParallelism: false,
          include: ['test/integration/**/*.int-spec.ts'],
          setupFiles: ['test/helpers/integration-setup.ts'],
          globalSetup: ['test/helpers/global-setup.ts'],
        },
      },
    ],
  },
});
