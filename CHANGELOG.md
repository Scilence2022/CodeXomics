# Changelog

All notable changes to CodeXomics will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.522.0-beta] - 2025-10-12 - 🚀 FIRST PUBLIC RELEASE

**🎉 Historic Milestone: First Public Release of CodeXomics**

This marks the **first public release** of CodeXomics, a revolutionary AI-powered bioinformatics analysis platform that represents a paradigm shift in how researchers interact with genomic data.

### 🌟 Revolutionary Features (New to the World)

#### **Multi-Agent AI System** - *World First*
- Revolutionary AI collaboration with multiple agents working together
- Intelligent coordination between AI coordinator and specialized worker agents
- Context-aware analysis with automatic tool selection
- Natural language interface for complex genomic queries
- Advanced conversation evolution tracking and decision analysis

#### **Comprehensive External Tools Integration**
- **ProGenFixer**: Protein engineering and sequence optimization
- **Deep Gene Research**: Advanced gene analysis platform
- **CHOPCHOP**: CRISPR design and analysis
- **KGML Pathway Viewer**: Interactive KEGG pathway visualization
- **STRING Networks**: Protein-protein interaction analysis
- **AlphaFold Integration**: Direct protein structure prediction

#### **Advanced LLM Ecosystem**
- Multi-provider support: OpenAI, Anthropic, Google Gemini, SiliconFlow, DeepSeek, Kimi
- Intelligent model selection for different task types
- MCP (Model Context Protocol) integration for seamless tool interoperability
- Comprehensive Chinese LLM support through SiliconFlow

#### **Pioneering AI Benchmark Framework**
- Industry-first comprehensive AI evaluation suite (22+ test cases)
- Multi-agent testing and coordination evaluation
- Real-time assessment with professional reporting
- Research-grade metrics for AI-powered bioinformatics

### 🏗️ Platform Foundation

#### **Core Bioinformatics Engine**
- Advanced genome visualization with SVG rendering
- Multi-track system (genes, sequences, variants, reads, proteins)
- Interactive navigation with context persistence
- Multi-format support (FASTA, GenBank, GFF, VCF, BAM, etc.)

#### **Extensible Plugin Architecture**
- Complete plugin system with marketplace
- AI integration for automatic plugin utilization
- Security validation and sandboxing
- Community ecosystem support

#### **Professional Engineering**
- Cross-platform support (macOS, Windows, Linux)
- Modular, maintainable codebase
- Comprehensive documentation (1,500+ lines)
- Enterprise-grade version management

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

### 📚 Documentation Excellence
- **Comprehensive User Guide**: 742 lines covering all features
- **Complete Developer Guide**: 831 lines for contributors
- **Professional Structure**: 223 organized documentation files
- **Clear Navigation**: Documentation hub with cross-references

### 🎯 Quality Assurance
- Multi-platform testing and validation
- Comprehensive test coverage
- Cross-configuration synchronization
- Professional release process

---

## Development History

### Note
CodeXomics development began as an ambitious project to revolutionize bioinformatics through AI integration. This first public release (v0.522beta) represents the culmination of extensive research and development to create the world's first multi-agent AI bioinformatics platform.

**Previous development was internal and focused on:**
- Core architecture design
- AI system integration
- Bioinformatics tool development
- Testing and validation
- Documentation preparation

---

## Release Links

- [v0.522beta](https://github.com/Scilence2022/CodeXomics/releases/tag/v0.522beta) - 🚀 **First Public Release**
- [Release Notes](RELEASE_NOTES_v0.522beta.md) - Complete release documentation
- [User Guide](../user-guides/USER_GUIDE.md) - Comprehensive user manual
- [Developer Guide](../developer-guides/DEVELOPER_GUIDE.md) - Development documentation

