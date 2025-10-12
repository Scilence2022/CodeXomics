# CodeXomics v0.522beta Release Notes

## 🎉 Beta Release - v0.522beta

**Release Date:** October 12, 2025  
**Version:** 0.522.0-beta

This is a beta release featuring new external tool integrations, improved LLM model organization, and enhanced testing infrastructure.

---

## ✨ New Features

### 🔧 ProGenFixer Integration
- Added **ProGenFixer** external tool integration for protein engineering and sequence optimization
- Direct access via Tools menu with keyboard shortcut `Cmd/Ctrl+Shift+P`
- Seamless browser window integration with session management
- URL: https://progenfixer.biodesign.ac.cn

### 🤖 LLM Model Improvements
- **Reorganized SiliconFlow models** by source and parameter size for better discoverability
- Added **Kimi K2 Pro** model support: `Pro/moonshotai/Kimi-K2-Instruct-0905`
- Grouped models by provider:
  - 🌐 Qwen Series (Alibaba Cloud)
  - 🧠 DeepSeek Series
  - 🌙 Kimi Series (Moonshot AI)
  - 💡 GLM Series (Zhipu AI)
  - 🎯 Yi Series (01.AI)
- Models within each group sorted by size (smallest to largest) for easier selection

### 📊 Enhanced Testing Infrastructure
- Improved benchmark UI with accurate test count display
- Refined manual test suite with better organization
- Enhanced tool parsing detection for flexible success cases
- Added comprehensive data export workflow tests

---

## 🐛 Bug Fixes

- Fixed LLM configuration persistence issues across multiple configuration files
- Resolved benchmark UI inconsistencies in test count display
- Enhanced data export workflow evaluation to handle edge cases
- Fixed tool parsing detection for 'SUCCESS - FLEXIBLE' and 'NO TOOLS DETECTED' scenarios

---

## 🔄 Improvements

### Version System
- Updated version display format to show beta designation clearly: **v0.522beta**
- Synchronized version information across all configuration files
- Improved version management with centralized version.js

### Code Quality
- Deep cleanup of deprecated `searchProteinByGene` legacy code
- Refactored manual test suite naming conventions
- Enhanced log parsing for better debugging capabilities
- Improved code organization and maintainability

---

## 📦 Installation

### macOS
- **Intel (x64):** CodeXomics-0.522.0-beta-x64.dmg
- **Apple Silicon (arm64):** CodeXomics-0.522.0-beta-arm64.dmg

### Windows
- **64-bit:** CodeXomics-Setup-0.522.0-beta-x64.exe
- **32-bit:** CodeXomics-Setup-0.522.0-beta-ia32.exe
- **Portable:** CodeXomics-0.522.0-beta-win.exe

### Linux
- **AppImage:** CodeXomics-0.522.0-beta-x64.AppImage
- **Debian:** codexomics_0.522.0-beta_amd64.deb
- **Snap:** Available via Snap Store (edge channel)

---

## ⚠️ Known Issues

This is a **beta release** and may contain bugs. Please report any issues on our [GitHub Issues page](https://github.com/Scilence2022/CodeXomics/issues).

---

## 🔗 Links

- **Repository:** https://github.com/Scilence2022/CodeXomics
- **Documentation:** [Coming Soon]
- **Report Issues:** https://github.com/Scilence2022/CodeXomics/issues

---

## 📝 What's Changed

Full changelog of commits in this release:

- `00265a7` - feat: Update version to v0.522beta with visible beta designation
- `fceb891` - feat: Reorganize SiliconFlow LLM models by source and size, fix Kimi K2 Pro model
- `b154cf7` - Add PROGENFIXER_INTEGRATION_SUMMARY.md and update source files
- `2716484` - Fix benchmark UI test count display and finalize manual test suite refactoring
- `0eaed67` - Fix benchmark UI inconsistencies and complete manual test suite refactoring
- `3c409a9` - Refactor manual test suite: rename ManualSimpleSuite to ManualSuite
- `703dad1` - fix: Enhance extractParseDebugInfoFromLogs to detect 'SUCCESS - FLEXIBLE' tool parsing
- `bb0352e` - fix: Enhance data export workflow evaluation to handle 'NO TOOLS DETECTED' cases
- `04dd206` - feat: Add comprehensive data export workflow test to AutomaticComplexSuite

---

## 👤 Author

**Lifu Song**  
Email: songlf@tib.cas.cn

---

## 📄 License

MIT License - See LICENSE file for details

---

**Thank you for using CodeXomics!** 🧬✨
