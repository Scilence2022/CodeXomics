'use strict';

const { defineConfig } = require('@playwright/test');

/**
 * Playwright configuration for Electron end-to-end smoke tests.
 *
 * These tests launch the real packaged-equivalent app (src/main.js) via Electron
 * and assert that the UI boots. They require a display — locally on macOS/Windows
 * they run directly; on Linux CI they must be wrapped with `xvfb-run`.
 *
 * Run with: npm run test:e2e
 */
module.exports = defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
});
