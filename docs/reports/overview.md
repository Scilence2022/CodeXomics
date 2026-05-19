# P0 Critical Security & Quality Fixes — Overview

## Branch

`fix/p0-critical-security-and-quality` (commit: 06403ef)

## What Was Done

### P0-1: DOMPurify + SanitizeService ✅

- **Installed**: `dompurify@3.4.2`
- **Created**: `src/renderer/modules/security/SanitizeService.js`
  - 6 sanitization methods: `sanitize()`, `sanitizeMarkdown()`, `sanitizeForGenomeBrowser()`, `safeSetInnerHTML()`, `stripHtml()`, `isUnsafe()`
  - 3 config profiles: default, markdown, genome browser
  - Singleton export + `window.SanitizeService` global
- **Modified**: `ChatManager.js` — replaced manual HTML sanitizer with DOMPurify-backed version via SanitizeService
- **Modified**: `ChatManager.js` — sanitized AI message display IDs (prevents ID injection)
- **Modified**: `PluginMarketplace.js` — replaced `eval()` with `new Function()` + error handling + security TODO for future sandboxing

### P0-2: Content Security Policy Strengthened ✅

- **Before**: `default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: file: https: http:` (allows ANY source)
- **After**: `default-src 'self' data: blob: file:` + `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://d3js.org https://cdn.jsdelivr.net data: blob:`
- Key change: script sources restricted to specific CDNs only

### P0-3: Vitest + 68 Tests (100% Pass) ✅

- **Installed**: `vitest@4.1.5`
- **Created test infrastructure**: `test/` with `unit/`, `integration/`, `mocks/`, `setup.js`
- **6 test files, 68 tests**:
  - `test/unit/sanitize-service.test.js` — 29 tests
  - `test/unit/tool-names.test.js` — 7 tests
  - `test/unit/default-settings.test.js` — 14 tests
  - `test/unit/tool-registry.test.js` — 9 tests
  - `test/integration/mcp-integration.test.js` — 5 tests
  - `test/integration/ipc-channels.test.js` — 4 tests

### P0-4: Enhanced ESLint + Pre-commit Hooks ✅

- **Updated**: `.eslintrc.json` with security + quality rules
  - Security: `no-eval`, `no-implied-eval`, `no-new-func`, `no-throw-literal`
  - Quality: `prefer-const`, `eqeqeq`, `curly`, `no-var`, `no-duplicate-imports`
- **Configured**: Husky pre-commit hook → lint-staged
- **Configured**: commitlint (conventional commits)
- **Added scripts**: `test`, `test:watch`, `test:coverage` in package.json

### P0-5: Remove Duplicate Locale Files ✅

- **Deleted**: `src/renderer/locales/` (10 files — en + zh-CN × 5 namespaces)
- **Modified**: `I18nManager.js` — now reads from shared `src/locales/` via `fs.readFileSync()` with `__dirname`-based path resolution (`../../locales` from `modules/`)
- **Modified**: `i18n-main.js` — fixed `getLocalesPath()` to always use `__dirname`-based path (removed broken `process.resourcesPath` branch that was never configured in `extraResources`)
- **Synced**: `en/menu.json` mcpSettings label matched to "External MCP Servers" (earlier rename was only applied to one copy)

## Test Results

```
 Test Files  6 passed (6)
      Tests  68 passed (68)
   Duration  378ms
```

## Known Issues

- `NODE_OPTIONS=--use-system-ca` causes Husky pre-commit hook to fail — needs environment fix
- `eslint-plugin-security` v3/v4 incompatible with ESLint 8 eslintrc format — used direct rules instead
- CSP still allows `unsafe-inline` and `unsafe-eval` — required by current no-bundler architecture

## Next Steps (P1)

- Enable `contextIsolation: true` + disable `nodeIntegration` in BrowserWindow configs
- Split `main.js` (10,584 lines) into separate modules
- Create DI container to reduce `window` global coupling
- Expand test coverage to 30% on core paths
- Replace `alert()` calls with Toast notification system
