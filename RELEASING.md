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

# Validate a complete set of release assets before uploading
npm run updates:validate
# Or validate one native build directory
npm run updates:validate -- --platform mac
```

## Auto-update flow

1. Supported packaged apps check the GitHub Releases feed 15 seconds after launch
   and every six hours while running. **Help → Check for Updates…** opens one
   status window immediately; repeated clicks reuse the current operation.
2. A newer compatible version appears with its release notes. The user chooses
   **Download Update** and can watch progress, cancel, retry, or close the window
   while continuing work. Checks and downloads never run concurrently.
3. SHA512 validation remains enforced by electron-updater. macOS additionally
   waits for Electron's native `update-downloaded` event: the library's own event
   and download promise can both finish before native signature validation.
4. **Restart and Install** reminds the user to save work in every window and
   requires an explicit restart confirmation. On macOS, a successfully staged
   update also applies on the next normal quit. Windows and Linux install only
   on the explicit restart action, avoiding unattended installation at shutdown.
5. Stable builds reject prereleases and downgrades. Development builds, Windows
   portable editions, Snap/Flatpak/store installs, and unpacked Linux builds show
   an explanation and the official releases link. AppImage and marked DEB/RPM
   packages support in-app updating; package installation may require elevation.
6. Network inactivity times out after 60 seconds, including during connection
   setup. Verification, permissions, disk-space, feed and server failures appear
   in the same status window; background check failures stay quiet and retry on
   the next scheduled check. Full diagnostics go to the application log.

## Build a complete draft release

Use **Actions → Build Signed Update Release → Run workflow** with an existing
tag exactly matching `v` plus `package.json`'s semantic version. The tag must
contain this workflow and the release scripts. This workflow builds on the native
macOS, Windows and Linux runners, verifies artifacts, then assembles a draft.
It never publishes a release automatically or changes an already published one.

Configure repository Actions secrets before running it:

| Secret                                                     | Purpose                                        |
| ---------------------------------------------------------- | ---------------------------------------------- |
| `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`                     | Exported Developer ID certificate and password |
| `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`                     | Windows Authenticode certificate and password  |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | Apple notarization credentials                 |

`CSC_LINK` secrets can contain base64 certificate data. The workflow's GitHub
token needs release write access only in the final draft assembly job. Signing
secrets are never embedded in the application. `build.win.publisherName` must
match the signing certificate's subject (currently `CodeXomics Team`); the Windows
job verifies this so an incompatible publisher cannot silently break updates.

`CODEXOMICS_RELEASE_BUILD=1` makes missing notarization credentials fatal, and
`forceCodeSigning` rejects unsigned macOS/Windows releases. The existing
`build/notarize.js` hook owns notarization; electron-builder's duplicate built-in
notarization is disabled. Local unsigned smoke builds remain supported.

The release must contain the metadata **and every referenced file** together:

| Platform | Metadata           | Required native artifacts                               |
| -------- | ------------------ | ------------------------------------------------------- |
| macOS    | `latest-mac.yml`   | x64 and arm64 ZIPs, plus DMG installers                 |
| Windows  | `latest.yml`       | x64 NSIS Setup EXE; portable EXE is a separate download |
| Linux    | `latest-linux.yml` | x64 AppImage and DEB                                    |

For prereleases, the channel name replaces `latest` (for example `beta-mac.yml`).
macOS architectures are built in one job so their ZIP entries share one manifest.
Linux AppImage and DEB are also built together. Snap remains distributed through
its store and is intentionally excluded from the GitHub updater workflow.
Artifact names include platform/architecture; NSIS and portable files have
distinct names. Upload `.blockmap` files too for differential downloads.

`npm run updates:validate` checks versions, required platform/architecture files,
local artifact paths, file sizes, SHA512 hashes, and legacy manifest fields. It
rejects portable executables in the Windows feed. All three build jobs must pass
before the final job revalidates the combined output and uploads it to a draft.
Uploading installers alone does **not** create a working update feed.

## Release checklist

1. Update the version: `npm run version-sync` (after bumping `src/version.js`).
2. `npm run version-validate` and `npm test` must pass.
3. Update `CHANGELOG.md`.
4. **Manual GUI QA** on each target platform (load a genome, run a tool, exercise
   the ChatBox) — required because the automated suite does not drive the GUI.
5. Tag the release and dispatch the signed-release workflow.
6. Test a real upgrade from an older installed build on each platform. Include
   offline checks, a cancelled download, retry, closing/reopening the status
   window, invalid signatures, and deferring/restarting after saving work.
7. Verify the draft contains all manifests and referenced artifacts, then publish
   it in GitHub Releases. Publishing makes it visible to installed clients.
