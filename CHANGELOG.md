# Changelog

All notable changes to CodeXomics will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.522.0-beta] - 2025-10-12

### Added
- **ProGenFixer Integration**: New external tool for protein engineering and sequence optimization
  - Direct access via Tools menu with keyboard shortcut `Cmd/Ctrl+Shift+P`
  - Integrated browser window with session management
  - URL: https://progenfixer.biodesign.ac.cn
- **Kimi K2 Pro Model**: Added support for `Pro/moonshotai/Kimi-K2-Instruct-0905`
- **Enhanced Testing Infrastructure**: Comprehensive data export workflow tests
- **Tool Parsing Detection**: Support for 'SUCCESS - FLEXIBLE' and 'NO TOOLS DETECTED' scenarios

### Changed
- **LLM Model Organization**: Reorganized SiliconFlow models by source and parameter size
  - Grouped by provider: Qwen, DeepSeek, Kimi, GLM, Yi
  - Sorted within groups by model size (smallest to largest)
  - Added emoji identifiers for better visual distinction
- **Version Display Format**: Updated to show beta designation as `v0.522beta`
- **Test Suite Refactoring**: Renamed ManualSimpleSuite to ManualSuite for clarity
- **Version Management**: Centralized version configuration in version.js

### Fixed
- **LLM Configuration Persistence**: Resolved synchronization issues across multiple configuration files
- **Benchmark UI**: Fixed test count display inconsistencies
- **Data Export Workflow**: Enhanced evaluation to handle edge cases
- **Legacy Code Cleanup**: Deep cleanup of deprecated `searchProteinByGene` functionality

### Improved
- Enhanced log parsing capabilities for better debugging
- Improved code organization and maintainability
- Better error handling in tool parsing detection
- More accurate progress tracking in benchmark tests

---

## [0.522.0] - Previous Version

### Note
This is the first tracked version in the changelog. Previous versions exist but are not documented here.

---

## Release Links

- [v0.522beta](https://github.com/Scilence2022/CodeXomics/releases/tag/v0.522beta) - Latest Beta Release

