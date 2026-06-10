import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/renderer/modules/**/*.js'],
      exclude: ['node_modules/', 'test/', 'dist/'],
      // Baseline coverage floor. Coverage is currently low because much of the
      // legacy suite asserts against source text rather than executing it; the
      // floor only guards against regression. Ratchet these upward as brittle
      // source-grep tests are replaced with behavioral tests.
      // See docs/developer-guides/TESTING_AND_DECOMPOSITION.md
      thresholds: {
        statements: 4,
        branches: 4,
        functions: 4,
        lines: 4,
      },
    },
    setupFiles: ['test/setup.js'],
  },
});
