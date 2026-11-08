# Release Guide

This guide describes the release workflow for CodeXomics. Historical release notes remain in this directory by version.

## Version Sources

Keep these files synchronized for release work:

- `package.json`
- `package-lock.json` after running `npm install` or version tooling
- `src/version.js`
- `CHANGELOG.md`
- `docs/release-notes/RELEASE_NOTES_v<major>.<minor>.md`
- `mkdocs.yml` version metadata when publishing documentation for a new release line
- `README.md`, `Agents.md`, and `Memory.md`
- `docs/index.md`, `docs/zh/index.md`, and both HTML pages in `docs/landing/`
- `docs/user-guides/GETTING_STARTED.md`

Use the existing version scripts where possible:

```bash
npm run version-sync
npm run version-validate
npm run docs:validate
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
npm run tool-registry:validate
npm run test:coverage
npm run docs:validate
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
RELEASE_NOTES_v0.723.md
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

Tag the merged release commit with the full semantic version prefixed by `v`.

```bash
git tag -a v0.723.0 -m "Release v0.723.0"
git push origin v0.723.0
```

## GitHub Release

Dispatch **Build Signed Update Release** for the matching version tag. The workflow
verifies native signing, update manifests and artifact checksums, and assembles a
draft only after all platforms pass. Smoke-test real upgrades before publishing
the draft; mark prerelease builds as prereleases. See the canonical
[release workflow](https://github.com/Scilence2022/CodeXomics/blob/main/RELEASING.md)
for signing secrets, package compatibility and required assets.

## GitHub Pages

The Pages source is `docs/` and `mkdocs.yml`. Do not edit generated `site/` output directly.

Before publishing, validate the canonical documents and strict site build:

```bash
npm run docs:validate
```

GitHub Pages uses the Documentation workflow on `main`. Merge the documentation pull request or run the workflow manually on `main` to deploy that branch's docs. `npm run docs:deploy` builds and pushes the generated `gh-pages` branch.

Do not edit `site/` or generated `gh-pages` content manually.
