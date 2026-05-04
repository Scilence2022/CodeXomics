# Project Manager UI Style Sync - Fix Summary

## What was done
The Project Manager window was a separate Electron BrowserWindow with ~2500 lines of **hardcoded CSS colors** — it never responded to UI Style changes from the main app. Fixed by:

1. **Defined 40+ CSS custom properties** (`--pm-*`) in `project-manager.html` `:root` block
2. **Replaced 224 hardcoded color references** with variable references throughout the CSS
3. **Built IPC theme sync pipeline**: Main renderer → `main.js` → PM window
4. **Updated JS files** to use CSS variables for dynamic colors

## Key Decisions
| Decision | Rationale |
|----------|-----------|
| File type icon colors kept as direct hex | Functional/semantic identifiers (FASTA=green, BAM=red etc.) |
| `--pm-on-accent` for button/icon text | Must always be white even in dark mode |
| `--pm-surface` for card/modal backgrounds | Adapts to theme (white → dark gray) |
| Body gradient cores (`#1e3c72`, `#2a5298`) kept | PM's signature deep blue identity |
| Theme sync via IPC chain | Main renderer and PM window are separate BrowserWindows |

## Files Modified (6)
- `src/project-manager.html` — CSS variables + theme sync listener
- `src/renderer/modules/ProjectManagerWindow.js` — text/notification colors
- `src/renderer/modules/ProjectManager.js` — empty state + save button gradients
- `src/main.js` — IPC handlers for theme relay
- `src/preload.js` — IPC channel whitelist
- `src/renderer/renderer-modular.js` — theme change forwarding

## Follow-up
- PM's theme is applied on load and on any style change in the main app
- Body gradient base colors could be made fully theme-variable in future
