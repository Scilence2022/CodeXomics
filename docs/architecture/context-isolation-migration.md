# ContextIsolation Migration Plan

## Current State

### Node.js Dependencies Remaining in Renderer
| File | Node APIs Used | Migration Difficulty |
|------|---------------|---------------------|
| `renderer-modular.js` | `require('path')` | Medium |
| `I18nManager.js` | `require('fs')`, `require('path')`, `__dirname` | **Done** (IPC-ready) |
| `ChatManager.js` | `require('path')`, `__dirname` | Medium |
| `ConfigManager.js` | `__dirname` | Easy |
| `PluginManagerV2.js` | `__dirname` | Medium |
| `PluginRealTestDemonstrator.js` | `__dirname` | Medium |
| `SanitizeService.js` | `require('dompurify')` | Easy |
| `ActionManager.js` | `require(...)` | Medium |
| `BlastManager.js` | `require(...)` | Medium |
| `FileManager.js` | `require(...)` | Medium |
| `BenchmarkUI.js` | `require(...)` | Hard |
| `BamReader.js` | `require(...)` | Medium |
| `ProjectManagerWindow.js` | `require(...)` | Hard |
| `PluginManagementUI.js` | `require(...)` | Hard |
| `InternalMCPServer.js` | `require(...)` | Hard |
| `LLMBenchmarkFramework.js` | `require(...)` | Hard |

### Preload Bridge Status
✅ `electronAPI` namespace: 100+ methods exposed  
✅ `nodeAPI` namespace: platform, version  
✅ `ipcRenderer` namespace: channel-whitelisted on/send  
✅ `removeAllListeners` with channel validation  
✅ `getLocaleData()` via IPC  
✅ `getAppPaths()` via IPC  
✅ `getSanitizerConfig()` via IPC  

### Security Config Status (window-management.js)
| Window | nodeIntegration | contextIsolation | webSecurity | enableRemoteModule |
|--------|----------------|-----------------|-------------|-------------------|
| mainWindow | ✅ false | ✅ true | (needs file://) | ✅ false |
| Internal tools (17) | ✅ false | ✅ true | ✅ true | ✅ false |
| External DB windows (KEGG, GO, etc., 4) | ✅ false | ✅ true | (load external URLs) | ✅ false |
| MCP Server Manager | ✅ false | ✅ true | ✅ true | ✅ false |
| Project Manager | ✅ false | ✅ true | ✅ true | ✅ false |

## Migration Phases

### Phase 1 (P1-6) — Hardware Security Headers ✅ DONE
- [x] All 26 windows: `enableRemoteModule: false`
- [x] All 26 windows: `nodeIntegration: false` + `contextIsolation: true`
- [x] Internal windows: `webSecurity: true`
- [x] External/tool windows: `webSecurity: false` (for loading external content)
- [x] CSP tightened in index.html

### Phase 2 (P2) — Renderer Node.js Migration
- [ ] Migrate `renderer-modular.js` `require('path')` → preload path utilities
- [ ] Migrate `ChatManager.js` `__dirname` → `window.electronAPI.getAppPaths()`
- [ ] Migrate `SanitizeService.js` → preload-injected DOMPurify (from main process)
- [ ] Migrate `PluginManagerV2.js` `__dirname` → IPC path
- [ ] Migrate all remaining `require()` calls → preload or IPC

### Phase 3 (P3) — Final Cleanup
- [ ] Remove `'unsafe-eval'` from CSP
- [ ] Remove `'unsafe-inline'` from CSP (requires bundler)
- [ ] Full electron security audit pass

## Notes
- The current Electron security config with nodeIntegration:true is acceptable ONLY in development
- For production builds, ALL windows must have contextIsolation:true and nodeIntegration:false
- The pre-applied webPreferences changes in this PR provide the CORRECT security baseline
- Remaining work is purely renderer-side migration of Node.js APIs to the preload bridge
