# Release Guide

This guide describes the release workflow for CodeXomics. Historical release notes remain in this directory by version.

## Version Sources

Keep these files synchronized for release work:

- `package.json`
- `package-lock.json` after running `npm install` or version tooling
- `src/version.js`
- `CHANGELOG.md`
- `docs/release-notes/RELEASE_NOTES_<version>.md`
- `mkdocs.yml` version metadata when publishing documentation for a new release line

Use the existing version scripts where possible:

```bash
npm run version-sync
npm run version-validate
```

## Pre-Release Checklist

1. Confirm the working tree contains only intended changes.
2. Run the relevant automated checks.
3. Validate version consistency.
4. Build the target platform packages.
5. Smoke-test the packaged app.
6. Update release notes.
7. Commit with a conventional commit message.
8. Tag the release.
9. Publish GitHub release assets.
10. Rebuild and publish GitHub Pages if public docs changed.

## Checks

```bash
npm test
npm run lint
npm run version-validate
```

Run focused tests when the release touches a specific subsystem, for example MCP, plugin, benchmark, tool registry, or renderer modules.

## Build Commands

```bash
npm run build:mac
npm run build:win
npm run build:linux
npm run build:all
```

The macOS build path uses the DMG background generation scripts before packaging.

## Release Notes

Create release notes under `docs/release-notes/` with a filename that includes the version, for example:

```text
RELEASE_NOTES_v0.7beta.md
```

Recommended sections:

- Summary
- Highlights
- New features
- Fixes
- Developer notes
- Known issues
- Download links

## Git Tag

Use the display tag style used by the project, for example:

```bash
git tag -a v0.7beta -m "Release v0.7beta"
git push origin v0.7beta
```

## GitHub Release

Upload generated assets from `dist/` and paste the release notes. Mark prerelease builds as prereleases in GitHub.

## GitHub Pages

The Pages source is `docs/` and `mkdocs.yml`. Do not edit generated `site/` output directly.

Before publishing:

```bash
mkdocs build --strict
```

If the local environment does not have MkDocs plugins installed, install the documented MkDocs dependencies in your release environment and rebuild there.
