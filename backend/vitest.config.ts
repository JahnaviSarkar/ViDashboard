import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    include: ['backend/tests/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: [
      process.cwd().endsWith('backend') ? 'tests/setup.ts' : 'backend/tests/setup.ts',
    ],
  },
});
