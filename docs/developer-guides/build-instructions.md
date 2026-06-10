# Build Instructions

This guide describes the supported development and packaging workflow for CodeXomics `0.722.0`.

## Supported Toolchain

| Component        | Supported baseline                       |
| ---------------- | ---------------------------------------- |
| Node.js          | 20.x or 22.x                             |
| npm              | 10 or newer                              |
| Electron         | `41.7.1`                                 |
| electron-builder | `25.x`                                   |
| Python           | 3.11 recommended for local MkDocs builds |

Node.js 20 and 22 are exercised by CI. Use an active LTS release and avoid changing the Electron pin without testing both CI versions and an unpacked package build.

## Platform Requirements

=== "macOS"

    - A current supported macOS release.
    - Xcode Command Line Tools: `xcode-select --install`.
    - Apple signing credentials only when producing distributable signed builds.

=== "Windows"

    - Windows 10 or newer.
    - Visual Studio Build Tools with the Desktop development with C++ workload when native modules need compilation.
    - An Authenticode certificate only for signed release builds.

=== "Linux"

    - A current Ubuntu/Debian-compatible distribution.
    - Standard compiler and Electron runtime libraries.

    ```bash
    sudo apt-get update
    sudo apt-get install -y build-essential libnss3 libatk-bridge2.0-0 \
      libatk1.0-0 libcups2 libgtk-3-0 libgbm1 libasound2 libxshmfence1 libxss1
    ```

## Install

```bash
git clone https://github.com/Scilence2022/CodeXomics.git
cd CodeXomics
npm install
```

Use `npm ci` in clean CI or release environments when the lockfile is already current.

Do not manually edit `package-lock.json`. If dependencies change, update the lockfile through npm.

## Run Locally

```bash
npm start
npm run dev
```

Optional combined services:

```bash
npm run mcp-server
npm run start-with-mcp
npm run marketplace:start
npm run start-with-marketplace
npm run start-full
```

## Validate Before Packaging

```bash
npm run lint
npm run version-validate
npm run tool-registry:validate
npm run test:coverage
npm run docs:validate
```

The Electron smoke suite launches the real application and may require a display server on Linux:

```bash
npm run test:e2e
```

## Package The Application

Fast unpacked package for the current platform:

```bash
npm run pack
```

Installer/package builds without publishing:

```bash
npm run dist
npm run build:mac
npm run build:win
npm run build:linux
```

Cross-platform packaging generally requires building on each target operating system. `npm run build:all` is available, but native signing and platform tooling still apply.

Generated packages are written to `dist/`, which is build output and should not be edited manually.

Configured targets:

| Platform | Targets                 | Architectures |
| -------- | ----------------------- | ------------- |
| macOS    | DMG and ZIP             | x64 and arm64 |
| Windows  | NSIS and portable EXE   | x64           |
| Linux    | AppImage, Snap, and DEB | x64           |

## Signing And Publishing

Release credentials are supplied through environment variables and must never be committed.

macOS signing and notarization:

```bash
export CSC_LINK="/path/to/DeveloperID.p12"
export CSC_KEY_PASSWORD="<certificate password>"
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="<app-specific password>"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

Windows signing:

```bash
export CSC_LINK="/path/to/codesign.pfx"
export CSC_KEY_PASSWORD="<certificate password>"
```

GitHub publishing:

```bash
export GH_TOKEN="<token with repository release access>"
npx electron-builder --mac --win --linux --publish always
```

See the root [`RELEASING.md`](https://github.com/Scilence2022/CodeXomics/blob/main/RELEASING.md) for the complete signed-release and auto-update workflow.

## Documentation Builds

```bash
npm run docs:serve
npm run docs:validate
npm run docs:deploy
```

- `docs:serve` starts a local preview.
- `docs:validate` checks release metadata and runs a strict MkDocs build.
- `docs:deploy` publishes generated output to the `gh-pages` branch.

The source is always `docs/` plus `mkdocs.yml`; never edit `site/` directly.

## Troubleshooting

### Clean Dependency Reinstall

Prefer preserving the lockfile:

```bash
rm -rf node_modules
npm ci
```

### Native Module Problems

```bash
npx electron-builder install-app-deps
```

Confirm the active Node.js version matches the supported matrix before rebuilding.

### Build Memory

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

### Linux Headless Smoke Test

```bash
xvfb-run --auto-servernum --server-args="-screen 0 1280x1024x24" npm run test:e2e
```

### Version Mismatch

`src/version.js` is the application version source. After intentionally changing it, synchronize and validate:

```bash
npm run version-sync
npm run version-validate
npm run docs:validate
```
