<div align="center">

# 🧬 CodeXomics

### AI-Powered Bioinformatics Analysis Platform

[![Version](https://img.shields.io/badge/version-0.522beta-blue.svg)](https://github.com/Scilence2022/CodeXomics/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/Scilence2022/CodeXomics/releases)
[![Electron](https://img.shields.io/badge/Electron-27.3.11-47848f.svg)](https://www.electronjs.org/)

A modern, cross-platform bioinformatics analysis platform built with Electron, featuring multi-agent AI collaboration, advanced plugin system, MCP integration, and comprehensive biological data analysis tools for exploring genomic, proteomic, and other omics data.

[Features](#-key-features) •
[Installation](#-installation) •
[Quick Start](#-quick-start) •
[Documentation](#-documentation) •
[Contributing](#-contributing)

</div>

---

## ✨ Key Features

### 🤖 **Multi-Agent AI System**
- **Collaborative Intelligence** - Multiple AI agents working together for complex genomic analysis
- **MCP Integration** - Model Context Protocol for seamless tool integration
- **Conversation Evolution v2** - Advanced conversation tracking and analysis system
- **Multi-Provider Support** - OpenAI, Anthropic, Google Gemini, SiliconFlow, DeepSeek, Kimi, and local LLMs
- **Intelligent Tool Selection** - Dynamic tool registry with context-aware selection
- **Benchmark Testing** - Comprehensive AI evaluation with 22+ test cases across 6 categories

### 🧬 **Advanced Genome Visualization**
- **Dynamic SVG-based GC Content/Skew** - Crisp, scalable visualization with adaptive window sizing
- **Interactive Tracks** - Genes, sequences, variants, reads, and proteins with resizable heights
- **Multi-format Support** - FASTA, GenBank, GFF/GTF, BED, VCF, BAM/SAM files
- **Real-time Navigation** - Smooth zooming, panning, and position jumping
- **User-defined Features** - Create custom annotations with sequence selection
- **Track State Persistence** - Automatically saves and restores track sizes and order across navigation and sessions
- **Multiple View Modes** - Grid, List, and Details views for project management

### 🔌 **Advanced Plugin System**
- **Modular Architecture** - Complete plugin system with PluginManager, SmartExecutor, and FunctionCallsOrganizer
- **AI Integration** - Plugins automatically callable by ChatBox LLM using JSON function calling
- **Security Sandbox** - Safe execution environment with parameter validation
- **Plugin Marketplace** - Built-in marketplace for discovering and installing community plugins
- **Zero Configuration** - Seamless LLM integration for new plugins
- **Core Plugins** - Biological Networks, Comparative Genomics, Metabolic Pathways, and more

### 🔧 **External Tools Integration**
- **ProGenFixer** - Protein engineering and sequence optimization tool
- **Deep Gene Research** - Advanced gene analysis and research platform  
- **CHOPCHOP** - CRISPR design and analysis tool
- **Customizable Tools** - Add your own external bioinformatics tools
- **Keyboard Shortcuts** - Quick access to frequently used tools
- **Session Management** - Persistent tool windows and state

### 🧪 **Benchmark Testing Interface** 
- **Comprehensive AI Evaluation** - 22+ test cases across 6 genomic analysis categories
- **Manual Test Interaction** - Interactive dialogs for human verification and scoring
- **Triple Classification System** - Automatic/manual evaluation, simple/complex tasks, 5 task types
- **Real-time Progress Tracking** - Live progress bars and statistics during test execution
- **Detailed Reporting** - Export test results, LLM interactions, and performance metrics
- **Professional Interface** - Full-screen testing environment with comprehensive configuration options
- **Multi-Agent Testing** - Evaluate multi-agent collaboration and coordination

### 🤖 **AI-Powered Assistant**
- **Natural Language Queries** - Ask questions about genes, functions, and genomic regions
- **Dynamic Tool Registry** - Intelligent tool selection based on user intent and context
- **Conversation Evolution** - Advanced conversation recording and analysis system
- **Multi-Provider Support** - OpenAI, Anthropic, Google Gemini, and local LLM integration
- **Smart Navigation** - AI can jump to genes, analyze regions, and provide insights
- **Interactive Chat** - Persistent conversation with genomic context awareness
- **Thinking Process** - View AI reasoning process for transparent analysis
- **Context-Aware Tools** - Tools adapt to current genome state and user queries

### 🔬 **Professional Analysis Tools**
- **KGML Pathway Viewer** - Complete KEGG pathway visualization tool with dynamic interaction
- **STRING Protein Networks** - Protein-protein interaction network analysis
- **Enhanced Gene Details** - Support for 50+ biological databases with automatic link detection
- **Sequence Analysis** - GC content, translation, reverse complement operations
- **Feature Annotation** - Create, edit, and manage genomic features interactively
- **Multi-track Visualization** - Synchronized views across different data types
- **Export Capabilities** - FASTA, GenBank, GFF, BED, and protein sequences

### 🗂️ **Project Management**
- **XML Project Format** - Save and load projects with ".prj.GAI" extension
- **Multiple View Modes** - Grid, List, and Details views for different workflows
- **Simple Mode** - Compact interface for streamlined workflows
- **File Tree Integration** - Organized project structure with automatic file management
- **Project Templates** - Pre-configured project setups for common workflows

### 📊 **Enhanced User Experience**
- **Modular Architecture** - Clean, maintainable codebase with separated concerns
- **Responsive Design** - Works seamlessly across different screen sizes
- **Keyboard Shortcuts** - Efficient navigation and operation shortcuts
- **Customizable Interface** - Adjustable track heights and panel layouts
- **Cross-Platform** - Native performance on macOS, Windows, and Linux

## 🚀 Installation

### **Download Pre-built Releases**

Download the latest version (v0.522beta) for your platform from [GitHub Releases](https://github.com/Scilence2022/CodeXomics/releases/tag/v0.522beta):

#### macOS
- **Intel (x64)**: `CodeXomics-0.522.0-beta-x64.dmg` (139 MB)
- **Apple Silicon (arm64)**: `CodeXomics-0.522.0-beta-arm64.dmg` (134 MB)

#### Windows  
- **Installer**: `CodeXomics Setup 0.522.0-beta.exe` (207 MB)
- **Portable**: `CodeXomics 0.522.0-beta.exe` (207 MB)

#### Linux
- **AppImage**: `CodeXomics-0.522.0-beta.AppImage` (144 MB)
- **Debian**: `codexomics_0.522.0-beta_amd64.deb` (93 MB)
- **Snap**: `codexomics_0.522.0-beta_amd64.snap` (124 MB)

### **Build from Source**
```bash
# Clone the repository
git clone https://github.com/Scilence2022/CodeXomics.git
cd CodeXomics

# Install dependencies
npm install

# Run in development mode
npm start

# Build for production
npm run build
```

## 📖 Quick Start

### **1. Install and Launch**
```bash
# Download for your platform from releases
# macOS: Open DMG and drag to Applications
# Windows: Run installer or portable exe  
# Linux: Make AppImage executable or install deb/snap

# Or build from source
git clone https://github.com/Scilence2022/CodeXomics.git
cd CodeXomics
npm install
npm start
```

### **2. Configure AI Models**
```
Options → Configure LLMs
├── Add API keys (OpenAI, Anthropic, Google, SiliconFlow)
├── Configure multi-agent settings
├── Test connections
└── Save configuration
```

### **3. Load Genomic Data**
```
File → Load File
├── Genome: FASTA, GenBank
├── Annotations: GFF, GTF, BED
├── Variants: VCF
└── Reads: BAM, SAM
```

### **4. Start Analyzing**
- **Ask AI**: "Find all DNA polymerase genes"
- **Use Tools**: Tools → ProGenFixer, KGML Viewer, STRING Networks
- **Run Benchmarks**: Benchmark & Debug → Open Benchmark
- **Create Projects**: File → New Project

### **5. Advanced Features**
- **Multi-Agent Mode**: Enable collaborative AI analysis
- **External Tools**: Quick access via keyboard shortcuts
- **Plugin Marketplace**: Install community plugins
- **Conversation Evolution**: Track AI reasoning and decision-making

## 🎯 Core Features

### **File Format Support**
| Format | Type | Import | Export | Notes |
|--------|------|---------|---------|-------|
| **FASTA** | Genome | ✅ | ✅ | Primary genome sequences |
| **GenBank** | Genome + Annotations | ✅ | ✅ | Complete genomic records |
| **GFF/GTF** | Annotations | ✅ | ✅ | Gene and feature annotations |
| **BED** | Regions | ✅ | ✅ | Genomic intervals and features |
| **VCF** | Variants | ✅ | ❌ | SNPs and structural variants |
| **SAM/BAM** | Alignments | ✅ | ❌ | Read mapping data |
| **WIG** | Track Data | ✅ | ✅ | Multi-track support and merging |
| **KGML** | Pathways | ✅ | ✅ | KEGG pathway visualization |
| **PRJ.GAI** | Projects | ✅ | ✅ | Complete project files |

### **Enhanced Database Integration**
Gene Details sidebar now supports 50+ biological databases:
- **Sequence Databases**: GenBank, RefSeq, UniProt
- **Functional Annotation**: GO, InterPro, Pfam, EC numbers
- **Literature**: PubMed, bioRxiv, DOI links, ORCID
- **Protein Structures**: PDB, AlphaFold, CATH, SCOP
- **Pathways**: KEGG, Reactome, MetaCyc
- **Species-specific**: FlyBase, WormBase, SGD, MGI
- **Chemical/Drug**: PubChem, ChEBI, ChEMBL

### **AI Integration with Dynamic Tool Registry**
```
User: "Find all DNA polymerase genes"
AI: [Dynamically selects search tools and displays results]

User: "What's the GC content of this region?"
AI: [Selects GC analysis tools and provides statistics]

User: "codon usage analysis of lacZ gene"
AI: [Intelligently selects codon_usage_analysis tool with gene context]

User: "Show me protein networks for this gene"
AI: [Launches STRING networks tool with gene context]

User: "Load the lac operon pathway"
AI: [Opens KGML viewer with relevant pathway]

User: "run benchmark tests"
AI: [Opens comprehensive benchmark interface for AI evaluation]
```

### **Benchmark Testing System**
Comprehensive AI evaluation with 22 test cases:
- **Navigation Tests** - Browser navigation and position jumping
- **Analysis Tests** - Sequence analysis and GC content calculation  
- **Data Loading Tests** - File loading and parsing verification
- **Search Tests** - Gene search and result validation
- **External Database Tests** - API integration and data retrieval
- **Workflow Tests** - Multi-step genomic analysis processes

**Manual Test Features:**
- Interactive verification dialogs with step-by-step checklists
- Flexible scoring system (0-10 points based on complexity)
- Real-time progress tracking and detailed reporting
- Export capabilities for test results and LLM interactions

### **Visualization Tracks**
- **🧬 Genes & Features** - Annotations with directional arrows and detailed information
- **🔤 Sequence** - DNA sequence with customizable display density
- **📊 GC Content & Skew** - Dynamic SVG visualization with adaptive window sizing
- **🔬 Variants** - SNPs and mutations with quality information
- **📋 Aligned Reads** - Read coverage and alignment visualization
- **⚗️ Proteins** - Translated sequences and protein features
- **🔗 Networks** - Protein-protein interaction networks
- **🛤️ Pathways** - KEGG pathway visualization with interactive elements

## 🔌 Plugin System

### **Available Plugins**
- **Biological Networks Plugin** - Network analysis and visualization
- **Comparative Genomics Plugin** - Multi-genome comparison tools
- **Metabolic Pathways Plugin** - Pathway analysis and visualization
- **Structural Genomics Plugin** - Protein structure analysis
- **Population Genomics Plugin** - Population-level analysis tools

### **Plugin Development**
```javascript
// Example plugin structure
const MyPlugin = {
    id: 'my-plugin',
    name: 'My Custom Plugin',
    version: '1.0.0',
    
    functions: {
        analyzeSequence: {
            description: 'Analyze DNA sequence',
            parameters: {
                sequence: { type: 'string', required: true }
            },
            execute: async (params) => {
                // Plugin logic here
                return { result: 'analysis complete' };
            }
        }
    },
    
    initialize: () => {
        // Plugin initialization
    }
};
```

### **Plugin Installation**
1. Access Plugin Marketplace from the menu
2. Browse available plugins
3. Click "Install" for desired plugins
4. Plugins automatically integrate with AI assistant

## 🎮 Usage Examples

### **Basic Navigation**
```bash
# Search for genes
Type "lacZ" in search bar → Press Enter

# Navigate to specific position
Type "chr1:1000-5000" in position input

# Switch view modes
Use View menu or toolbar buttons for Grid/List/Details
```

### **Advanced Tools**
```bash
# Open KGML Pathway Viewer
Tools → Visualization Tools → KGML Pathway Viewer (Ctrl+Shift+K)

# Launch STRING Networks
Tools → Bioinformatics Tools → STRING Protein Networks

# Access Gene Details
Click any gene to see enhanced database cross-references
```

### **Project Management**
```bash
# Create new project
File → New Project → Choose template

# Save project
File → Save Project (saves as .prj.GAI format)

# Switch view modes
View → Grid/List/Details or use toolbar buttons
```

### **AI Interaction with Dynamic Tool Registry**
```
Enhanced Queries with Intelligent Tool Selection:
- "Show me all ribosomal genes" → [Selects gene search tools]
- "Analyze protein networks for this gene" → [Selects STRING network tools]
- "codon usage analysis of lacZ gene" → [Selects codon analysis tools]
- "Load the glycolysis pathway" → [Selects pathway visualization tools]
- "Find genes involved in DNA repair" → [Selects gene search and analysis tools]
- "Export the current sequence as FASTA" → [Selects sequence export tools]
- "What databases have information on this gene?" → [Selects database search tools]
- "Calculate GC content of this region" → [Selects GC analysis tools]
- "Find ORFs in this sequence" → [Selects ORF prediction tools]
- "Search for protein structures" → [Selects AlphaFold/PDB search tools]
```

## ⚙️ Configuration

### **AI Assistant Setup**
1. **OpenAI Configuration**:
   ```json
   {
     "provider": "openai",
     "apiKey": "your-api-key",
     "model": "gpt-4",
     "baseURL": "https://api.openai.com/v1"
   }
   ```

2. **Local LLM Setup**:
   ```json
   {
     "provider": "local",
     "apiKey": "not-required",
     "model": "llama3",
     "baseURL": "http://localhost:11434/v1"
   }
   ```

### **Application Settings**
Configuration files stored in: `~/.codexomics/`
- `config.json` - Main application settings
- `llm-config.json` - AI provider configurations
- `ui-preferences.json` - Interface customizations
- `chat-history.json` - Conversation history
- `plugins.json` - Plugin configurations
- `projects.json` - Project management settings

### **Project Structure**
```
Documents/GenomeExplorer Projects/
├── ProjectName/
│   ├── data/                   # Project data files
│   ├── ProjectName.prj.GAI     # Project file
│   └── metadata.json          # Project metadata
```

## 🛠️ Development

### **Architecture Overview**
```
src/
├── main/                       # Electron main process
├── tools_registry/            # Dynamic Tool Registry System
│   ├── registry_manager.js    # Core registry management
│   ├── system_integration.js  # System integration layer
│   ├── tool_categories.yaml   # Tool categorization metadata
│   └── [category_dirs]/       # Tool definition directories
│       ├── navigation/        # Navigation tools
│       ├── sequence/          # Sequence analysis tools
│       ├── data_management/   # Data management tools
│       ├── protein/           # Protein analysis tools
│       └── ...                # Other tool categories
├── renderer/                   # Browser application
│   ├── modules/               # Core modules
│   │   ├── FileManager.js            # File operations
│   │   ├── TrackRenderer.js          # Visualization engine
│   │   ├── NavigationManager.js      # Search & navigation
│   │   ├── ChatManager.js            # AI integration with Dynamic Tools
│   │   ├── ProjectManager.js         # Project management
│   │   ├── PluginManager.js          # Plugin system
│   │   ├── ConversationEvolutionManager.js  # Conversation tracking
│   │   └── Plugins/                  # Plugin implementations
│   │       ├── BiologicalNetworksPlugin.js
│   │       ├── ComparativeGenomicsPlugin.js
│   │       └── MetabolicPathwaysPlugin.js
│   └── renderer-modular.js    # Main application
├── bioinformatics-tools/       # Specialized tools
│   ├── kgml-viewer.html       # KGML pathway viewer
│   ├── string-networks.html   # STRING networks
│   └── protein-structures.html # Protein visualization
└── assets/                     # Static resources
```

### **Plugin System Architecture**
```
Plugin System Components:
├── PluginManager.js              # Core plugin management
├── PluginFunctionCallsIntegrator.js  # LLM integration
├── SmartExecutor.js              # Intelligent execution
├── FunctionCallsOrganizer.js     # Function categorization
├── PluginSecurityValidator.js    # Security validation
└── PluginMarketplace.js          # Plugin distribution
```

### **Dynamic Tool Registry Architecture**
```
Dynamic Tool Registry Components:
├── registry_manager.js           # Core registry management
├── system_integration.js         # System integration layer
├── tool_categories.yaml          # Tool categorization metadata
└── [category_dirs]/              # Tool definition directories
    ├── navigation/               # Navigation tools (8 tools)
    ├── sequence/                 # Sequence analysis tools (8 tools)
    ├── data_management/          # Data management tools (4 tools)
    ├── protein/                  # Protein analysis tools (6 tools)
    ├── database/                 # Database integration tools (6 tools)
    ├── ai_analysis/              # AI analysis tools (5 tools)
    ├── pathway/                  # Pathway analysis tools (2 tools)
    ├── sequence_editing/         # Sequence editing tools (10 tools)
    ├── plugin_management/        # Plugin management tools (12 tools)
    ├── coordination/             # Multi-agent coordination (15 tools)
    └── external_apis/            # External API tools (12 tools)
```

## 🧪 Testing

### **Test Structure**
```
test/
├── unit-tests/                 # Individual component tests
├── integration-tests/          # Multi-component tests
├── fix-validation-tests/       # Bug fix verification
└── plugin-tests/              # Plugin system tests
```

### **Sample Data**
The application includes enhanced sample data:
- **E. coli genome** - Complete bacterial genome with annotations
- **KGML pathways** - Example pathway files for visualization
- **Protein networks** - STRING interaction data
- **Test sequences** - Various sequence formats and features

### **Testing Commands**
```bash
# Run all tests
npm test

# Test specific components
npm run test:plugins
npm run test:ai-integration
npm run test:visualization

# Test plugin system
npm run test:plugin-framework
```

## 🔧 Troubleshooting

### **Common Issues**

**Plugin System Issues**:
- Verify plugin installation through Plugin Marketplace
- Check plugin compatibility with current version
- Review plugin logs in developer console

**AI Assistant not responding**:
- Check API key configuration in Settings
- Verify internet connection for cloud providers
- Test connection using the "Test Connection" button

**KGML Viewer Issues**:
- Ensure KGML file is valid XML format
- Check file permissions and accessibility
- Verify pathway data completeness

**Project Loading Problems**:
- Check .prj.GAI file integrity
- Verify project directory structure
- Ensure all referenced files are accessible

**Performance issues**:
- Reduce visible track count for large genomes
- Use Simple Mode for better performance
- Close unused visualization tools

### **Advanced Troubleshooting**

**Conversation Evolution Issues**:
- Check conversation recording in developer console
- Verify storage permissions
- Reset conversation history if needed

**Database Link Issues**:
- Verify internet connection for external databases
- Check if database URLs are accessible
- Report broken links for database updates

## 📊 Performance

### **Optimization Features**
- **SVG Rendering** - Hardware-accelerated graphics for smooth performance
- **Lazy Loading** - Components load only when needed
- **Plugin Sandboxing** - Isolated execution prevents conflicts
- **Memory Management** - Efficient cleanup and resource management
- **Caching** - Intelligent caching for frequently accessed data
- **Simple Mode** - Reduced UI complexity for better performance

### **System Requirements**
- **RAM**: 6GB minimum, 12GB recommended (increased for plugin system)
- **Storage**: 1GB for application, additional space for plugins and data
- **CPU**: Modern multi-core processor recommended
- **Graphics**: Hardware acceleration supported for better performance
- **Network**: Internet connection for AI services and database links

## 🚀 Future Roadmap

### **Planned Features**
- **Enhanced Plugin Marketplace** - Advanced plugin discovery and ratings
- **Multi-genome comparison** - Compare multiple genomes side-by-side
- **Advanced AI models** - Integration with specialized biological AI models
- **Cloud integration** - Direct access to genomic databases
- **Collaborative features** - Share annotations and analysis with teams
- **Real-time collaboration** - Multi-user editing and analysis

### **Long-term Vision**
- **Advanced analytics** - Machine learning-powered genomic insights
- **Mobile support** - Tablet and mobile device compatibility
- **Distributed computing** - Large-scale analysis capabilities
- **Integration ecosystem** - Connect with major bioinformatics platforms

## 📝 Contributing

We welcome contributions from the genomics and bioinformatics community!

### **How to Contribute**
1. **Fork the repository** on GitHub
2. **Create a feature branch** from main
3. **Make your changes** with appropriate tests
4. **Submit a pull request** with detailed description

### **Plugin Development**
1. **Study existing plugins** in `src/renderer/modules/Plugins/`
2. **Follow plugin API** specifications
3. **Test with Plugin Test Framework**
4. **Submit to Plugin Marketplace**

### **Development Guidelines**
- Follow existing code style and patterns
- Add documentation for new features
- Include tests for new functionality
- Update relevant markdown documentation
- Test plugin compatibility

## 📝 What's New in v0.522beta

### **🎉 Major Features**
- ✅ **Multi-Agent AI System** - Collaborative AI agents for complex analysis workflows
- ✅ **MCP Integration** - Model Context Protocol for seamless tool interoperability
- ✅ **ProGenFixer Integration** - Direct access to protein engineering tools
- ✅ **Conversation Evolution v2** - Enhanced AI conversation tracking and analysis
- ✅ **Enhanced Benchmark Suite** - Comprehensive AI evaluation with 22+ test cases
- ✅ **SiliconFlow Models** - Reorganized by source (Qwen, DeepSeek, Kimi, GLM, Yi)
- ✅ **Kimi K2 Pro** - Latest Pro model integration

### **🐛 Bug Fixes**
- ✅ **LLM Configuration Persistence** - Fixed multi-file synchronization issues
- ✅ **Benchmark UI** - Accurate test count display and progress tracking
- ✅ **Tool Parsing** - Enhanced detection for flexible success cases
- ✅ **Data Export Workflow** - Improved edge case handling

### **⚡ Performance Improvements**
- ✅ **Version Management** - Centralized version system with automatic sync
- ✅ **Code Cleanup** - Removed deprecated legacy code
- ✅ **Test Suite** - Refactored manual test organization
- ✅ **Log Parsing** - Enhanced debugging capabilities

📋 **Full Changelog**: [CHANGELOG.md](CHANGELOG.md)  
📦 **Release Notes**: [docs/release-notes/RELEASE_NOTES_v0.522beta.md](docs/release-notes/RELEASE_NOTES_v0.522beta.md)

## 📚 Documentation

- **[User Guide](docs/user-guides/)** - Comprehensive usage instructions
- **[Developer Guide](docs/developer-guides/)** - Contribution and development setup
- **[API Reference](docs/api-docs/)** - Complete API documentation
- **[Fix Summaries](docs/fix-summaries/)** - Implementation details and bug fixes
- **[Release Notes](docs/release-notes/)** - Version history and changes

## 🤝 Contributing

We welcome contributions from the genomics and bioinformatics community!

### **How to Contribute**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [PROJECT_RULES.md](PROJECT_RULES.md) for development guidelines.

## 🐛 Issues and Support

- **Bug Reports**: [GitHub Issues](https://github.com/Scilence2022/CodeXomics/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/Scilence2022/CodeXomics/discussions)
- **Email**: songlf@tib.cas.cn

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Electron** - Cross-platform desktop app framework
- **D3.js** - Data visualization library
- **OpenAI/Anthropic/Google** - AI model providers
- **SiliconFlow** - Chinese LLM integration platform
- **KEGG** - Pathway data and visualization
- **STRING** - Protein interaction networks
- **AlphaFold** - Protein structure predictions
- **ProGenFixer** - Protein engineering tools
- **Bioinformatics Community** - Inspiration and feedback

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/Scilence2022/CodeXomics?style=social)
![GitHub forks](https://img.shields.io/github/forks/Scilence2022/CodeXomics?style=social)
![GitHub issues](https://img.shields.io/github/issues/Scilence2022/CodeXomics)
![GitHub pull requests](https://img.shields.io/github/issues-pr/Scilence2022/CodeXomics)

---

<div align="center">

**CodeXomics v0.522beta** - Intelligent Bioinformatics Analysis with Multi-Agent AI

Made with ❤️ by the CodeXomics Team

[⬆ Back to Top](#-codexomics)

</div> 

