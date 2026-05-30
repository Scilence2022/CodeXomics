# CodeXomics v0.533beta - UI Style System

## 🎨 Multi-Preset UI Theming

**Release Date:** April 9, 2026  
**Version:** 0.533.0-beta  
**Milestone:** Multi-Preset UI Style System

CodeXomics now supports switching between multiple interface style presets at runtime, allowing users to personalize the application's look and feel without restarting.

---

## ✨ New Features

### 🎨 UI Style Switcher

Switch interface styles via **Options → General Settings → Appearance → UI Style**. Four presets are available:

| Preset                   | Accent Color                 | Philosophy                                  | Inspired By                   |
| ------------------------ | ---------------------------- | ------------------------------------------- | ----------------------------- |
| **AI Dynamic** (default) | Blue-violet `#3b82f6`        | Vibrant, energetic, futuristic AI aesthetic | Default Electron apps, Vercel |
| **Professional**         | Deep teal `#0d7377`          | Clean, muted tones for scientific work      | SnapGene, Benchling           |
| **Minimal**              | Warm amber `#c87d2f`         | Elegant warm-gray with understated accent   | Notion, Linear, Bear          |
| **Pastel**               | Soft lavender-rose `#b07fb0` | Light, airy, dreamy feel                    | Figma, pastel design systems  |

Each preset includes:

- Complete color palette via CSS custom properties
- Per-preset override file (`src/renderer/css/themes/<preset>.css`) covering all UI components
- Dark mode support with dedicated dark variable overrides
- Style selection cards with color preview swatches in Settings
- Session persistence via `configManager`

### 🔘 Mac-Style Toggle Switches

- Sidebar toggle replaced with Mac-style toggle switch (matching MCP Bridge toggle design)
- Both toggles follow the active UI style preset color

---

## 🐛 Bug Fixes

- **Save Settings no longer reverts UI style** — Previously, clicking "Save Settings" would revert some buttons back to the default blue-purple because `applyAccentColor()` overrode the preset's primary color. Now guarded with a check that skips accent color override when a non-default UI Style is active.
- **General Settings modal footer follows drag** — The Save Settings / Cancel buttons and resize handles were placed outside `modal-content`, causing them to detach during drag. Moved inside to match other modals.
- **All toolbar buttons follow style switching** — BLAST, Load File, New Chat, Send, Context toggle, Add Features, and Chat toggle buttons now properly switch colors with the active preset.
- **MCP Bridge toggle state persists** — The status bar MCP toggle state now correctly saves and restores across sessions.

---

## 🔧 Technical Details

### New Files

| File                                       | Purpose                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `src/renderer/modules/ThemeManager.js`     | Preset definitions, CSS variable injection, style switching, dark mode |
| `src/renderer/css/themes/professional.css` | Professional theme override rules (753 lines)                          |
| `src/renderer/css/themes/minimal.css`      | Minimal theme override rules (775 lines)                               |
| `src/renderer/css/themes/pastel.css`       | Pastel theme override rules (775 lines)                                |

### Modified Files

| File                                             | Change                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/renderer/css/base.css`                      | Added CSS variables for gradients, accents, chat colors, button gradients, focus rings  |
| `src/renderer/css/buttons.css`                   | Replaced hardcoded `rgba(59,130,246)` with `var(--primary-rgb)`                         |
| `src/renderer/css/components.css`                | Replaced hardcoded rgba values with `var(--primary-rgb)`                                |
| `src/renderer/css/layout.css`                    | Replaced hardcoded gradients with CSS variables                                         |
| `src/renderer/css/chatbox-enhancements.css`      | Replaced hardcoded gradients with CSS variables                                         |
| `src/renderer/modules/GeneralSettingsManager.js` | `applyUIStyle()` syncs accentColor; `applyAccentColor()` guarded; execution order fixed |
| `src/renderer/index.html`                        | Style preset cards UI, theme CSS links, Mac-style sidebar toggle                        |
| `src/renderer/renderer-modular.js`               | Sidebar toggle event handler, ThemeManager initialization                               |
| `src/renderer/modules/UIManager.js`              | `toggleSidebar()` with checkbox sync, `updateToggleButtonStates()` for checkbox         |
| `AGENTS.md`                                      | UI Style System documentation with step-by-step guide for adding presets                |

### Architecture

The theming system uses two complementary mechanisms:

1. **CSS Custom Properties** — `ThemeManager.applyStyle()` injects all preset variables into `:root` at runtime, overriding the defaults in `base.css`
2. **Attribute Selectors** — `[data-ui-style="<preset>"]` selectors in per-preset CSS files override hardcoded colors in `styles.css` that can't be changed via custom properties alone

⚠️ **Known limitation**: Some hardcoded colors in `styles.css` keyframe animations (e.g., `ai-color-breathe`) cannot be overridden via CSS variables and remain unchanged across presets.

---

## 📚 Documentation

- Added **UI Style System (Multi-Preset Theming)** section to `AGENTS.md` with a complete 5-step guide for adding new presets
- Documented the `applyAccentColor` override pitfall that can cause style reversion on save
