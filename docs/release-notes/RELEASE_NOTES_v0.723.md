# CodeXomics v0.723.0 Release Notes

- **Release date:** October 29, 2026
- **Application version:** `0.723.0`
- **In-app display:** `v0.723`
- **Plugin API:** `2.0.0`

## Summary

This release completes the application updater and its signed release pipeline,
and incorporates main-menu fixes and previously unreleased application improvements.
The runtime remains Electron `41.7.1`, with Node.js 20 or 22 and npm 10+ for builds.

## Application Updates

- One update window shows checks, release notes, download progress, cancellation,
  verification failures, retries and confirmed restart installation.
- Startup checks repeat every six hours. Stable builds reject prereleases and
  downgrades, and unsupported package types explain their update method.
- Electron requests time out on inactivity, including before response headers.
- macOS installation readiness waits for native signature validation.
- SHA512 checks and native signature verification remain enabled. Windows and
  Linux installation requires an explicit restart; macOS also stages on quit.

## Release Engineering

- Native macOS, Windows and Linux builds provide manifests and referenced artifacts.
- Missing signing/notarization credentials fail release builds. Windows signing
  identities must match the configured updater publisher.
- Combined release artifacts are validated before upload to a draft. macOS ZIPs
  cover both Intel and Apple Silicon; Linux includes AppImage and DEB; Windows
  provides NSIS and a separately named portable edition.

## Other Changes

- Repairs main-menu actions, project-manager dispatch and keyboard shortcuts.
- Includes the source tree's agent settings, streaming, annotation review and
  performance improvements since the previous public beta.

## Installation And Compatibility

Save work in all windows before installing. Older public beta packages lack a
complete update feed; users may need to install this release manually once.
Portable and store-managed installations use their manual or package-manager
update route. See [the user guide](../user-guides/USER_GUIDE.md) and the canonical
[release procedure](https://github.com/Scilence2022/CodeXomics/blob/main/RELEASING.md).

## Validation And Availability

The updater was validated with unit tests, real Electron window/network checks,
and unsigned local macOS packaging. Native signing and upgrade installation must
pass release QA before the draft is made public. See the
[update audit](../reports/SOFTWARE_UPDATE_AUDIT.md) for validation details and limits.
