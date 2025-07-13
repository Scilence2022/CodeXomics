# Genome AI Studio v0.3 beta

A modern, cross-platform genome analysis studio built with Electron, featuring an advanced plugin system, AI-powered natural language interaction, and comprehensive bioinformatics tools for exploring genomic data.

## ✨ Key Features

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

### 🤖 **AI-Powered Assistant**
- **Natural Language Queries** - Ask questions about genes, functions, and genomic regions
- **Conversation Evolution** - Advanced conversation recording and analysis system
- **Multi-Provider Support** - OpenAI, Anthropic, Google Gemini, and local LLM integration
- **Smart Navigation** - AI can jump to genes, analyze regions, and provide insights
- **Interactive Chat** - Persistent conversation with genomic context awareness
- **Thinking Process** - View AI reasoning process for transparent analysis

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
Download the latest version for your platform from [GitHub Releases](https://github.com/Scilence2022/GenomeAIStudio/releases):

- **macOS**: `Genome-AI-Studio-0.3.0-beta.dmg`
- **Windows**: `Genome-AI-Studio-Setup-0.3.0-beta.exe`
- **Linux**: `Genome-AI-Studio-0.3.0-beta.AppImage`

### **Build from Source**
```bash
# Clone the repository
git clone https://github.com/Scilence2022/GenomeAIStudio.git
cd GenomeAIStudio

# Install dependencies
npm install

# Run in development mode
npm start

# Build for production
npm run build
```

## 📖 Quick Start Guide

### **1. Load Your Genome Data**
- Click **"Load File"** in the header
- Select your genome file (FASTA, GenBank, etc.)
- Choose additional annotation files (GFF, BED, VCF)

### **2. Create or Open a Project**
- Use **File → New Project** to create a structured project
- Or **File → Open Project** (Ctrl+Shift+O) to load existing ".prj.GAI" files
- Switch between Grid, List, and Details views as needed

### **3. Configure AI Assistant**
- Click **"Options"** → **"Configure LLMs"**
- Add your API key for OpenAI, Anthropic, or Google
- Test the connection and save settings

### **4. Explore Advanced Tools**
- Access **Tools → Visualization Tools → KGML Pathway Viewer** (Ctrl+Shift+K)
- Try **Tools → Bioinformatics Tools → STRING Protein Networks**
- Use the enhanced Gene Details sidebar for database cross-references

### **5. Install Plugins**
- Access the Plugin Marketplace through the menu
- Browse and install community-developed plugins
- Plugins automatically integrate with the AI assistant

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

### **AI Integration**
```
User: "Find all DNA polymerase genes"
AI: [Searches genome and displays results]

User: "What's the GC content of this region?"
AI: [Analyzes current view and provides statistics]

User: "Show me protein networks for this gene"
AI: [Launches STRING networks tool with gene context]

User: "Load the lac operon pathway"
AI: [Opens KGML viewer with relevant pathway]
```

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

### **AI Interaction**
```
Enhanced Queries:
- "Show me all ribosomal genes"
- "Analyze protein networks for this gene"
- "Load the glycolysis pathway"
- "Find genes involved in DNA repair"
- "Export the current sequence as FASTA"
- "What databases have information on this gene?"
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
Configuration files stored in: `~/.genome-ai-studio/`
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
├── renderer/                   # Browser application
│   ├── modules/               # Core modules
│   │   ├── FileManager.js            # File operations
│   │   ├── TrackRenderer.js          # Visualization engine
│   │   ├── NavigationManager.js      # Search & navigation
│   │   ├── ChatManager.js            # AI integration
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

## 📝 Recent Updates (v0.3 beta)

### **Major Enhancements**
- ✅ **Complete Plugin System** - Full plugin architecture with marketplace
- ✅ **KGML Pathway Viewer** - Advanced pathway visualization tool
- ✅ **Enhanced Gene Details** - 50+ database cross-references
- ✅ **STRING Networks** - Protein interaction network analysis
- ✅ **Project Management** - XML project format with multiple view modes
- ✅ **Conversation Evolution** - Advanced AI conversation tracking
- ✅ **AlphaFold Integration** - Protein structure prediction access

### **Bug Fixes**
- ✅ **View Mode Functionality** - Fixed Grid/List/Details view switching
- ✅ **Simple Mode Consistency** - Unified interface appearance
- ✅ **Track Settings** - Consistent rendering after settings changes
- ✅ **Protein Structure Viewer** - Fixed dependency loading issues
- ✅ **Database Links** - Improved external database connectivity

### **System Improvements**
- ✅ **Menu Reorganization** - Streamlined menu structure
- ✅ **Performance Optimization** - Better memory management
- ✅ **Security Enhancement** - Plugin sandboxing and validation
- ✅ **Cross-platform Compatibility** - Improved file path handling

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Electron** - Cross-platform desktop app framework
- **D3.js** - Data visualization library
- **OpenAI/Anthropic** - AI model providers
- **KEGG** - Pathway data and visualization
- **STRING** - Protein interaction networks
- **AlphaFold** - Protein structure predictions
- **Bioinformatics Community** - Inspiration and feedback

---
**Genome AI Studio** - Intelligent genomic analysis with advanced plugin system for the modern researcher 

