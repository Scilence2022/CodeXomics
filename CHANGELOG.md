# Changelog

All notable changes to CodeXomics will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### ✨ New Features

- Added a dedicated Primers track with toolbar toggle, track settings support, and ChatBox/MCP primer annotation list/clear tools.

## [0.7.0-beta] - 2026-05-08 - BETA UPDATE

**🔧 Milestone: Version Update to v0.7beta**

### ✅ Changes

- Updated version to v0.7beta
- Updated Agents.md to v0.7beta

## [0.6.0-beta] - 2026-05-04 - BETA UPDATE

**🔧 Milestone: Version Update to v0.6beta**

### ✅ Changes

- Updated version to v0.6beta
- Updated Agents.md to v0.6beta

## [0.533.0-beta] - 2026-04-09 - BETA UPDATE

**🎨 Milestone: Multi-Preset UI Style System**

### ✨ New Features

#### **UI Style Switcher**

CodeXomics now supports multiple interface style presets that can be switched at runtime via **General Settings → Appearance → UI Style**. The system uses CSS custom properties (`:root` variables) and `[data-ui-style]` attribute selectors for comprehensive theming.

| Style        | Accent Color       | Description                                  |
| ------------ | ------------------ | -------------------------------------------- |
| AI Dynamic   | Blue-violet        | Vibrant blue-purple gradient style (default) |
| Professional | Deep teal          | Clean teal-neutral tones for scientific work |
| Minimal      | Warm amber         | Elegant warm-gray with amber accent          |
| Pastel       | Soft lavender-rose | Soft lavender-rose with light airy tones     |

- `ThemeManager` module manages style presets, CSS variable injection, and dark mode overrides
- Per-preset CSS override files under `src/renderer/css/themes/` cover all hardcoded colors
- Style preset selection UI with color preview swatches in General Settings
- UI style preference persists across sessions via `configManager`
- Dark mode support with per-preset dark variable overrides

#### **Mac-style Toggle Switches**

- Replaced the Sidebar toggle button with a Mac-style toggle switch (`label.mac-toggle` + checkbox)
- MCP Bridge status toggle already uses the Mac-style component
- Both toggles follow the active UI style preset color

### 🐛 Bug Fixes

- **Fixed Save Settings reverting UI Style colors** — `applyAccentColor()` now guards against overriding preset primary colors when a non-default UI Style is active; execution order in `applySettings()` ensures `applyUIStyle()` runs last
- **Fixed General Settings modal footer position** — Moved `modal-footer` (Save Settings / Cancel) and resize handles inside `modal-content` so they follow drag operations
- **Fixed buttons not following style switching** — Added comprehensive CSS overrides for BLAST, Load File, New Chat, Send, Context toggle, Add Features, and toolbar Chat buttons across all preset themes
- **Fixed MCP Bridge toggle state persistence** — Status bar MCP toggle state now correctly saves and restores across sessions
- **Replaced hardcoded `rgba(59,130,246)` with `var(--primary-rgb)`** in `buttons.css` so button hover shadows follow theme colors

### 📚 Documentation

- Added **UI Style System (Multi-Preset Theming)** section to `Agents.md` with step-by-step guide for adding new presets
- Documented the critical `applyAccentColor` override pitfall

### 🔧 Technical Details

- `src/renderer/modules/ThemeManager.js` — New module: preset definitions, `applyStyle()`, `switchStyle()`, dark mode support
- `src/renderer/css/base.css` — Added CSS variables for gradients, accents, chat colors, button gradients, focus rings
- `src/renderer/css/themes/professional.css` — Professional theme override rules
- `src/renderer/css/themes/minimal.css` — Minimal theme override rules
- `src/renderer/css/themes/pastel.css` — Pastel theme override rules
- `src/renderer/modules/GeneralSettingsManager.js` — `applyUIStyle()` syncs accentColor with preset; `applyAccentColor()` guarded for non-default styles
- `src/renderer/renderer-modular.js` — Sidebar toggle event handler updated for checkbox `change` event

## [0.532.0-beta] - 2026-04-02 - BETA UPDATE

**🔧 Milestone: AI Assistant Guidelines & Build v0.532**

### 📚 Documentation

- Created `Agents.md` as a dedicated instruction set for autonomous AI coding helpers (Copilot, Cursor, etc.).
- Integrated AI coding guidelines into `README.md` contributing rules.
- Linked AI guidelines into developer documentation.

## [0.531.0-beta] - 2026-03-31 - BETA UPDATE

**🔧 Milestone: Multi-Agent System Core Improvements**

### 🤖 Multi-Agent System

- Enhanced agent coordination logic and tool routing.
- Improved performance tracking and caching for agent executions.

## [0.530.0-beta] - 2026-03-04 - BETA UPDATE

**🔧 Milestone: ChatBox Dock/Float Improvements and UI Fixes**

### ✅ New Features and Enhancements

#### **ChatBox Drag-and-Dock**

- Added drag-and-drop support for switching ChatBox between docked and floating modes
- Drag floating ChatBox to right edge to dock with visual "Dock Here" indicator
- Drag docked ChatBox left to undock with auto-trigger at 80px threshold
- Visual indicators for docking (blue) and undocking (green) actions

### 🐛 Bug Fixes

#### **UI Fixes**

- Fixed Options menu dropdown covering issue caused by banner hide/show mechanism
- Changed header overflow from hidden to visible to allow dropdowns to overflow
- Increased dropdown menu z-index to ensure menus appear above all elements

### 🔧 Technical Improvements

#### **Code Quality**

- Created comprehensive ChatManager.js refactoring plan (21,479 lines analyzed)
- Identified 360+ methods and proposed modular architecture

## [0.529.0-beta] - 2026-01-19 - BETA UPDATE

**🔧 Milestone: UI Improvements for Gene Details**

### ✅ Changes

- Updated version to v0.529beta
- Modified Gene Details sidebar attachment button to default to "All Files" filter instead of "Genome Files"

## [0.528.0-beta] - 2026-01-01 - BETA UPDATE

**🔧 Milestone: Version Update and Build**

### ✅ Changes

- Updated version to v0.528beta
- Build install packages

## [0.527.0-beta] - 2025-12-26 - ENHANCED BETA RELEASE

**✨ Milestone: Enhanced Beta with Improved Plugin System and UI Streamlining**

This release focuses on improving the plugin system, streamlining the user interface, and fixing critical bugs for better stability.

### ✅ New Features and Enhancements

#### **Plugin System Improvements**

- Improved plugin update check: Only checks updates when marketplace is opened
- Updated plugin download counts tracking
- Enhanced plugin system architecture

#### **UI/UX Enhancements**

- Menu structure optimization: Removed redundant Analysis Tools and Visualization Tools submenus
- Streamlined tool access with direct menu items
- Fixed CSS syntax errors and improved styling consistency

#### **AI and Chatbox Improvements**

- Added chatbox thinking history for transparent AI reasoning
- Enhanced AI response formatting

#### **Tool and Feature Updates**

- Fixed PDB viewer functionality
- Swapped BLAST service positions for better accessibility
- Updated version format for better build compatibility

#### **Performance and Stability**

- GPU fixes for Windows systems
- Fixed typos in error messages
- Enhanced error reporting

### 🔧 Technical Improvements

#### **Build System Updates**

- Enhanced version compatibility for all platform builds
- Updated build scripts for better consistency

#### **Menu Structure Changes**

- Removed: Analysis Tools submenu from main menu
- Removed: Visualization Tools submenu from main menu

#### **Plugin Update Optimization**

- Reduced network calls by checking updates only when marketplace is opened

#### **CSS and Styling**

- Fixed CSS syntax errors in styles.css
- Improved styling consistency across the application

### 🐛 Bug Fixes

#### **Core Functionality Fixes**

- PDB viewer fix for protein structure visualization
- CSS syntax error fixes

#### **Platform-Specific Fixes**

- GPU acceleration fixes for Windows systems

#### **Plugin System Fixes**

- Improved plugin update checking mechanism

#### **Error Handling Fixes**

- Fixed typos in error messages
- Enhanced error reporting for better debugging

## [0.526.0-beta] - 2025-12-XX - BETA UPDATE

**🔧 Milestone: Version Update and Bug Fixes**

### ✅ Changes

- Updated version to v0.526beta

## [0.525.0-beta] - 2025-12-XX - BETA UPDATE

**🔧 Milestone: Version Update and Build Improvements**

### ✅ Changes

- Updated to v0.525beta
- Build packages for all platforms
- Swapped BLAST service positions

## [0.524.0-beta] - 2025-12-XX - BETA UPDATE

**🔧 Milestone: Bug Fixes and Minor Improvements**

### ✅ Changes

- Multiple improvements including chatbox thinking history and PDB viewer

## [0.523.0-beta] - 2025-12-XX - BETA UPDATE

**🔧 Milestone: Version Update**

### ✅ Changes

- Updated version to v0.523beta

## [0.522.0-beta] - 2025-10-12 - 🧪 FIRST BETA RELEASE

**🔬 Milestone: First Beta Release of CodeXomics**

We're excited to share the **first beta release** of CodeXomics, focusing on core genome visualization and basic AI integration, with several experimental features under active development for community testing and feedback.

### ✅ Stable Features Ready for Testing

#### **Core Genome Visualization**

- SVG-based genome browser with multi-track support
- Interactive navigation and zooming capabilities
- File format support (FASTA, GenBank, GFF, VCF, BAM)
- Project save/load functionality

#### **Basic AI Integration**

- LLM provider support (OpenAI, Anthropic, Google, SiliconFlow)
- Natural language query interface
- AI benchmark testing framework
- Configuration management system

### 🚧 Experimental Features (Under Development)

#### **Multi-Agent AI System** _(Early Development)_

- Basic framework implemented, needs extensive testing and refinement
- Simple AI coordination, limited agent specialization
- Not yet reliable for complex workflows

#### **External Tools Integration** _(Prototype Stage)_

- **KGML Pathway Viewer**: Basic implementation, needs UI improvements
- **STRING Networks**: Initial integration, requires better data handling
- **ProGenFixer**: Simple browser window integration
- **Deep Gene Research**: Basic external link integration
- **CHOPCHOP**: Basic external tool access
- Status: All tools require significant development for production use

#### **Plugin System** _(Basic Framework)_

- Simple plugin loading system implemented
- Basic API structure in place
- No marketplace or comprehensive security validation yet
- Requires significant development for production use

#### **MCP Integration** _(Experimental)_

- Initial Model Context Protocol implementation
- Limited tool interoperability
- Highly experimental and subject to major changes

### 🛠️ Platform Features

#### **Bioinformatics Engine**

- Genome visualization with SVG rendering
- Multi-track system (genes, sequences, variants, reads, proteins)
- Interactive navigation with context persistence
- Support for multiple file formats (FASTA, GenBank, GFF, VCF, BAM, etc.)

#### **Plugin Architecture**

- Plugin system with marketplace support
- AI integration for plugin utilization
- Security validation and sandboxing
- Community ecosystem support

#### **Engineering Practices**

- Cross-platform support (macOS, Windows, Linux)
- Modular, maintainable codebase
- Comprehensive documentation (1,500+ lines)
- Consistent version management

### 🔧 Technical Implementation

#### Added

- Multi-agent AI coordination system
- Dynamic tool registry with intelligent selection
- MCP protocol integration
- ProGenFixer external tool integration
- Kimi K2 Pro model support
- Comprehensive benchmark testing framework
- Enhanced documentation structure

#### Changed

- **LLM Model Organization**: Reorganized SiliconFlow models by source and parameter size
  - Grouped by provider: Qwen, DeepSeek, Kimi, GLM, Yi
  - Sorted within groups by model size (smallest to largest)
  - Added emoji identifiers for better visual distinction
- **Version Display Format**: Updated to show beta designation as `v0.522beta`
- **Test Suite Refactoring**: Renamed ManualSimpleSuite to ManualSuite for clarity
- **Version Management**: Centralized version configuration in version.js

#### Fixed

- **LLM Configuration Persistence**: Resolved synchronization issues across multiple configuration files
- **Benchmark UI**: Fixed test count display inconsistencies
- **Data Export Workflow**: Enhanced evaluation to handle edge cases
- **Legacy Code Cleanup**: Deep cleanup of deprecated `searchProteinByGene` functionality

#### Improved

- Enhanced log parsing capabilities for better debugging
- Improved code organization and maintainability
- Better error handling in tool parsing detection
- More accurate progress tracking in benchmark tests

### 📚 Documentation

- **User Guide**: 742 lines covering features and usage
- **Developer Guide**: 831 lines for contributors
- **Organized Structure**: 223 documentation files
- **Clear Navigation**: Documentation hub with cross-references

### 🔧 Quality & Testing

- Multi-platform testing and validation
- Test coverage across core features
- Configuration synchronization
- Structured release process

---

## Development History

### Note

CodeXomics development focused on creating an AI-integrated bioinformatics platform. This first beta release (v0.522beta) provides stable core genome visualization and basic AI integration, with several experimental features included for community testing and feedback. The experimental features require significant development before production readiness.

**Previous development focused on:**

- Core architecture design
- AI system integration
- Bioinformatics tool development
- Testing and validation
- Documentation preparation

---

## Release Links

- [v0.522beta](https://github.com/Scilence2022/CodeXomics/releases/tag/v0.522beta) - 🧪 **First Beta Release**
- [Release Notes](RELEASE_NOTES_v0.522beta.md) - Complete beta release documentation
- [User Guide](../user-guides/USER_GUIDE.md) - Comprehensive user manual
- [Developer Guide](../developer-guides/DEVELOPER_GUIDE.md) - Development documentation
