# Testing Strategy & Module Decomposition Plan

This guide describes how CodeXomics is tested today, the direction the test suite
should evolve, and a concrete plan for breaking up the largest modules.

## Current state

- **771+ unit tests** run under Vitest (`npm test`).
- A large fraction of the legacy suite asserts against **source text** —
  `fs.readFileSync(module)` followed by `expect(source).toContain('...')`. These
  "source-grep" tests verify that code *looks* a certain way, not that it
  *behaves* correctly. They break on harmless refactors (see the
  `config-ipc-hardening` regression) and contribute almost nothing to executed
  coverage (~4%).
- There were **no end-to-end tests** exercising the actual Electron app.

## Target testing pyramid

1. **Behavioral unit tests** — import the module and assert on its return values
   / side effects. New code must ship with these. Examples added recently:
   - `test/unit/secret-store.test.js` (encrypt/decrypt round-trips, migration,
     fail-soft, recursion).
   - `test/unit/content-security-policy.test.js` (CSP invariants).
2. **Integration tests** — exercise a handler or service with its real
   collaborators (mock only the OS/Electron boundary).
3. **E2E smoke tests** — launch the real app with Playwright and assert the UI
   boots (`test/e2e/smoke.spec.js`, `npm run test:e2e`).

### Testing main-process modules

`require('electron')` returns a path string outside an Electron runtime, so main
modules that touch Electron APIs are awkward to import in Vitest. Two patterns:

- **Test seam** — resolve the Electron dependency through a small injectable
  accessor with a `__setXForTesting()` export (see `src/main/secret-store.js`).
- **Mock module** — `vi.mock('electron', () => ({ ... }))` with a `vi.hoisted`
  state object; reserve for modules that capture the API lazily.

Prefer extracting pure logic into a dependency-free helper that can be tested
directly, leaving a thin Electron-bound shell.

### Coverage gate

`vitest.config.mjs` enforces a baseline coverage floor (currently 4%). This only
guards against regression. **Ratchet the thresholds upward** as source-grep tests
are replaced with behavioral tests — aim for 30%+ on actively developed modules.

### Migrating a source-grep test

1. Identify the behavior the `toContain` assertions were proxying for.
2. Import the module (use a seam/mock for Electron).
3. Assert on inputs → outputs / state changes.
4. Delete the string assertions.

## Module decomposition plan

Several modules have grown well past a maintainable size and concentrate change
risk. They should be split along the service boundaries that already exist
(`renderer/modules/chat/services/`, `renderer/modules/tracks/`,
`renderer/modules/Agents/`).

| Module                                | Lines  | Suggested split                                                                 |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `renderer/modules/ChatManager.js`     | ~16k   | message orchestration vs. tool-call execution vs. rendering vs. sequence utils  |
| `renderer/modules/TrackRenderer.js`   | ~16k   | per-track-type renderers (genes, reads, variants, GC, WIG) behind a registry    |
| `renderer/renderer-modular.js`        | ~11k   | bootstrap/wiring only; move feature logic into modules                          |
| `renderer/modules/ActionManager.js`   | ~7.7k  | group actions by domain (navigation, edit, file, analysis)                      |
| `main/ipc-handlers.js`                | ~4.1k  | split per domain (config, files, blast, tools) like `project-ipc.js` already is |
| `main/menu-builder.js`                | ~92 KB | one builder module per window/menu                                              |

### Approach (per module)

1. Pick one cohesive responsibility (e.g. ChatManager's sequence-search helpers).
2. Extract it into a new module under the matching `services/` directory with a
   focused public API.
3. Add **behavioral tests for the extracted unit** before wiring it back in.
4. Replace the original code with a delegating call.
5. Keep each extraction a small, independently reviewable PR — never a big-bang
   rewrite. Verify with `npm test` and `npm run test:e2e` after each step.

### Guardrails

- Do not change behavior during an extraction; refactor and feature work are
  separate commits.
- Because the renderer cannot be fully unit-tested, run the Playwright smoke test
  after structural changes.
