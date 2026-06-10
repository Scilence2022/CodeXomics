# Releasing CodeXomics

This document describes how to produce signed, notarized, auto-updatable builds.

## Overview

- Packaging is done with **electron-builder**.
- Updates are delivered with **electron-updater**, which reads the `build.publish`
  feed configured in `package.json` (GitHub Releases by default).
- macOS builds are code-signed and notarized; Windows builds are Authenticode
  signed. All credentials are supplied through environment variables — none are
  committed to the repository.

## Prerequisites

| Platform | Requirement                                                                   |
| -------- | ----------------------------------------------------------------------------- |
| macOS    | Apple Developer Program membership + a "Developer ID Application" certificate |
| Windows  | An Authenticode code-signing certificate (`.pfx`)                             |
| Publish  | A GitHub token with `repo` scope (`GH_TOKEN`)                                 |

## Environment variables

### macOS signing + notarization

```bash
# Signing: either install the Developer ID cert in the login keychain, or:
export CSC_LINK="/path/to/DeveloperID.p12"     # or a base64 data: URL
export CSC_KEY_PASSWORD="<p12 password>"

# Notarization (build/notarize.js runs as the electron-builder afterSign hook):
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"   # appleid.apple.com
export APPLE_TEAM_ID="XXXXXXXXXX"                          # 10-char Team ID
```

If the `APPLE_*` variables are not set, notarization is skipped automatically and
the build still completes (useful for local testing). An un-notarized macOS build
will be blocked by Gatekeeper on other machines.

### Windows signing

```bash
export CSC_LINK="/path/to/codesign.pfx"        # or WIN_CSC_LINK
export CSC_KEY_PASSWORD="<pfx password>"
```

### Publishing

```bash
export GH_TOKEN="<github personal access token with repo scope>"
```

## Commands

```bash
# Local unpacked build (no signing, fast smoke test)
npm run pack

# Build installers for the current OS without publishing
npm run dist

# Build per platform
npm run build:mac
npm run build:win
npm run build:linux

# Build and publish to the configured GitHub Releases feed
npx electron-builder --mac --win --linux --publish always
```

## Auto-update flow

1. `npx electron-builder … --publish always` uploads the installers **and** the
   update metadata (`latest.yml`, `latest-mac.yml`, `latest-linux.yml`) to a
   GitHub Release.
2. On launch, packaged apps call `autoUpdater.checkForUpdates()` (see
   `src/main/updater.js`), download a newer version in the background, and prompt
   the user to restart. Users can also trigger a check from **Help → Check for
   Updates…**.
3. macOS auto-update requires the **zip** target (already configured) alongside
   the dmg.

## Release checklist

1. Update the version: `npm run version-sync` (after bumping `src/version.js`).
2. `npm run version-validate` and `npm test` must pass.
3. Update `CHANGELOG.md`.
4. **Manual GUI QA** on each target platform (load a genome, run a tool, exercise
   the ChatBox) — required because the automated suite does not drive the GUI.
5. Tag the release and run the publish command with credentials set.
