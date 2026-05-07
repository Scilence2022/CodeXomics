import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/renderer/modules/'],
      exclude: ['node_modules/', 'test/', 'dist/'],
    },
    setupFiles: ['test/setup.js'],
  },
});
