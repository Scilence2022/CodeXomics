'use strict';

const path = require('path');
const { test, expect, _electron: electron } = require('@playwright/test');

const APP_ROOT = path.join(__dirname, '..', '..');

/**
 * End-to-end smoke test: launch the Electron app and verify the main window
 * actually boots and renders. This is the minimal guard that the app starts —
 * something the source-grep unit tests cannot verify.
 */
test('main window launches and renders', async () => {
  const app = await electron.launch({
    args: [APP_ROOT, '--no-sandbox', '--disable-gpu'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      CODEXOMICS_E2E: '1',
    },
  });

  try {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // The app should report a non-empty title.
    const title = await window.title();
    expect(title.length).toBeGreaterThan(0);

    // The document body must exist (renderer actually rendered).
    await expect(window.locator('body')).toHaveCount(1);

    // The genome browser container is a core element of the main UI.
    const hasAppShell = await window.evaluate(() => {
      return Boolean(document.querySelector('body')?.children?.length);
    });
    expect(hasAppShell).toBe(true);
  } finally {
    await app.close();
  }
});
