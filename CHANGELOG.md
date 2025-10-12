# Changelog

All notable changes to CodeXomics will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.522.0-beta] - 2025-10-12 - 🚀 FIRST PUBLIC RELEASE

**🎉 Milestone: First Public Release of CodeXomics**

We're excited to share the **first public release** of CodeXomics, an AI-powered bioinformatics analysis platform that aims to enhance how researchers interact with genomic data through multi-agent AI collaboration.

### ✨ Key Features Introduced

#### **Multi-Agent AI System**
- Collaborative AI system with multiple agents working together
- Intelligent coordination between AI coordinator and specialized worker agents
- Context-aware analysis with automatic tool selection
- Natural language interface for genomic queries
- Conversation evolution tracking and decision analysis

#### **External Tools Integration**
- **ProGenFixer**: Protein engineering and sequence optimization
- **Deep Gene Research**: Advanced gene analysis platform
- **CHOPCHOP**: CRISPR design and analysis
- **KGML Pathway Viewer**: Interactive KEGG pathway visualization
- **STRING Networks**: Protein-protein interaction analysis
- **AlphaFold Integration**: Direct protein structure prediction

#### **LLM Ecosystem Support**
- Multi-provider support: OpenAI, Anthropic, Google Gemini, SiliconFlow, DeepSeek, Kimi
- Flexible model selection for different task types
- MCP (Model Context Protocol) integration for tool interoperability
- Support for Chinese LLMs through SiliconFlow

#### **AI Benchmark Framework**
- Comprehensive AI evaluation suite (22+ test cases)
- Multi-agent testing and coordination evaluation
- Real-time assessment with detailed reporting
- Metrics for evaluating AI-powered bioinformatics tools

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
CodeXomics development focused on creating an AI-integrated bioinformatics platform. This first public release (v0.522beta) represents our initial effort to combine multi-agent AI systems with genomic analysis tools.

**Previous development focused on:**
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

