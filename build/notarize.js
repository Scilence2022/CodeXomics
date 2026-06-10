'use strict';

/**
 * electron-builder afterSign hook: notarizes the macOS app with Apple.
 *
 * Notarization runs only when ALL of the following environment variables are set,
 * so unsigned local/CI `--dir` builds and non-macOS builds are unaffected:
 *
 *   APPLE_ID                      Apple Developer account email
 *   APPLE_APP_SPECIFIC_PASSWORD  app-specific password (appleid.apple.com)
 *   APPLE_TEAM_ID                10-character Apple Developer Team ID
 *
 * Code signing itself is handled by electron-builder when a Developer ID
 * certificate is available (in the login keychain, or via the CSC_LINK /
 * CSC_KEY_PASSWORD environment variables).
 */

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log(
      '[notarize] Skipping notarization — set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID to enable it.'
    );
    return;
  }

  const { notarize } = require('@electron/notarize');
  const appName = context.packager.appInfo.productFilename;
  const appBundleId = context.packager.appInfo.id || 'com.codexomics.app';
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`[notarize] Submitting ${appPath} to Apple notary service…`);
  const started = Date.now();
  await notarize({
    appBundleId,
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });
  console.log(`[notarize] Notarization complete in ${Math.round((Date.now() - started) / 1000)}s`);
};
