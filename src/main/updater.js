'use strict';

/**
 * Auto-update integration via electron-updater.
 *
 * On startup (packaged builds only) the app checks the configured publish
 * provider — GitHub Releases by default, see the `build.publish` block in
 * package.json — for a newer version, downloads it in the background, and prompts
 * the user to restart once it is ready. A manual "Check for Updates…" entry is
 * also exposed through `checkForUpdates()`.
 *
 * Everything is wrapped defensively: update failures (offline, no release feed,
 * unsigned dev build) must never block or crash the app.
 */

let initialized = false;
let manualCheckInProgress = false;

function getAutoUpdater() {
  const { autoUpdater } = require('electron-updater');
  return autoUpdater;
}

function configureUpdater(autoUpdater) {
  try {
    const log = require('electron-log/main');
    autoUpdater.logger = log;
  } catch (error) {
    // electron-log is optional for the updater
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
}

function promptInstall(info) {
  try {
    const { dialog, BrowserWindow } = require('electron');
    const parent = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
    const version = info && info.version ? info.version : 'A new version';
    dialog
      .showMessageBox(parent, {
        type: 'info',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update Ready',
        message: `${version} has been downloaded.`,
        detail: 'Restart CodeXomics to apply the update. It will also be applied automatically the next time you quit.',
      })
      .then(({ response }) => {
        if (response === 0) {
          getAutoUpdater().quitAndInstall();
        }
      })
      .catch(() => {});
  } catch (error) {
    // ignore — the update is still applied on next quit (autoInstallOnAppQuit)
  }
}

function notifyNoUpdate() {
  if (!manualCheckInProgress) return;
  manualCheckInProgress = false;
  try {
    const { dialog, BrowserWindow } = require('electron');
    const parent = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
    dialog
      .showMessageBox(parent, {
        type: 'info',
        buttons: ['OK'],
        title: 'No Updates',
        message: 'You are running the latest version of CodeXomics.',
      })
      .catch(() => {});
  } catch (error) {
    // ignore
  }
}

/**
 * Initialize the updater and run the initial background check.
 * No-op for unpackaged (dev) builds.
 */
function initUpdater() {
  try {
    const { app } = require('electron');
    if (!app.isPackaged) {
      console.log('[updater] Skipping auto-update (app is not packaged)');
      return;
    }
    if (initialized) return;
    initialized = true;

    const autoUpdater = getAutoUpdater();
    configureUpdater(autoUpdater);

    autoUpdater.on('error', err => console.error('[updater] error:', err && err.message ? err.message : err));
    autoUpdater.on('update-available', info => console.log('[updater] update available:', info && info.version));
    autoUpdater.on('update-not-available', () => {
      console.log('[updater] no update available');
      notifyNoUpdate();
    });
    autoUpdater.on('update-downloaded', info => {
      console.log('[updater] update downloaded:', info && info.version);
      promptInstall(info);
    });

    autoUpdater.checkForUpdates().catch(err => {
      console.error('[updater] initial check failed:', err && err.message ? err.message : err);
    });
  } catch (error) {
    console.error('[updater] init failed:', error && error.message ? error.message : error);
  }
}

/**
 * Manual update check (e.g. from the Help menu). Shows a dialog if already
 * up to date. Falls back gracefully in dev builds.
 */
function checkForUpdates() {
  try {
    const { app, dialog, BrowserWindow } = require('electron');
    if (!app.isPackaged) {
      const parent = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
      dialog
        .showMessageBox(parent, {
          type: 'info',
          buttons: ['OK'],
          title: 'Updates',
          message: 'Update checks are only available in packaged builds.',
        })
        .catch(() => {});
      return;
    }
    if (!initialized) {
      initUpdater();
    }
    manualCheckInProgress = true;
    getAutoUpdater()
      .checkForUpdates()
      .catch(err => {
        manualCheckInProgress = false;
        console.error('[updater] manual check failed:', err && err.message ? err.message : err);
      });
  } catch (error) {
    console.error('[updater] checkForUpdates failed:', error && error.message ? error.message : error);
  }
}

module.exports = {
  initUpdater,
  checkForUpdates,
};
