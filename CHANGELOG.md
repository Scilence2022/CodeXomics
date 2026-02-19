# Changelog

All notable changes to CodeXomics will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
