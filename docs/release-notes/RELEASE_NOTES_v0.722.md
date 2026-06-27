# CodeXomics v0.722.0 Release Notes

- **Release date:** June 10, 2026
- **Application version:** `0.722.0`
- **In-app display:** `v0.722`
- **Plugin API:** `2.0.0`

## Summary

CodeXomics `0.722.0` is a production-readiness release focused on security boundaries, release engineering, automated quality gates, and a more reliable Electron runtime. It also adds a dedicated Primers track and closes tool-registry gaps affecting dynamic prompts and benchmark runs.

CodeXomics `0.722.0` uses Electron `41.7.1` for compatibility with the supported Node.js 20 and 22 CI matrix.

## Security And Reliability

- Encrypts LLM API keys at rest with Electron `safeStorage` and migrates legacy plaintext values on save.
- Strengthens renderer Content Security Policy and keeps direct Node.js access behind the preload/IPC boundary.
- Removes the macOS debugger entitlement from production packaging.
- Adds structured application logging and crash capture.
- Adds a private vulnerability-reporting policy in `SECURITY.md`.

## Release Engineering

- Adds auto-update support through `electron-updater` and GitHub release metadata.
- Adds Apple notarization and code-signing hooks driven by environment variables.
- Upgrades the application from Electron `27.3.11` to `41.7.1` and electron-builder `25.x`.
- Keeps production dependency audit results clean at the release cut.

## Quality And CI

- Validates lint, application versions, tool-registry consistency, coverage, and unpacked packaging in CI.
- Adds a Playwright Electron smoke-test harness through `npm run test:e2e`.
- Documents test architecture and large-module decomposition strategy.
- Adds documentation metadata validation and strict MkDocs builds for the public site.

## Features And Fixes

- Adds a dedicated Primers track with toolbar visibility controls and track settings.
- Adds ChatBox and MCP tools for listing and clearing primer annotations.
- Adds the missing `get_operons` registry schema.
- Restores Node.js 20-compatible Electron installation after the initial release dependency upgrade.

## Build Requirements

- Node.js 20 or 22.
- npm 10 or newer.
- Platform build tools required by electron-builder.

See [Build Instructions](../developer-guides/build-instructions.md) and the root [`RELEASING.md`](https://github.com/Scilence2022/CodeXomics/blob/main/RELEASING.md).

## Availability

Download installers from [GitHub Releases](https://github.com/Scilence2022/CodeXomics/releases), or build from source for the latest changes. Releases are published periodically, so verify the version listed on a release before downloading.
