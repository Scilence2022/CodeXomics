# Genome AI Studio

A modern, cross-platform genome analysis studio built with Electron, featuring an user-friendly interface for exploring genomic data with AI-powered natural language interaction.

## ✨ Key Features

### 🧬 **Advanced Genome Visualization**
- **Dynamic SVG-based GC Content/Skew** - Crisp, scalable visualization with adaptive window sizing
- **Interactive Tracks** - Genes, sequences, variants, reads, and proteins with resizable heights
- **Multi-format Support** - FASTA, GenBank, GFF/GTF, BED, VCF, BAM/SAM files
- **Real-time Navigation** - Smooth zooming, panning, and position jumping
- **User-defined Features** - Create custom annotations with sequence selection

### 🤖 **AI-Powered Assistant**
- **Natural Language Queries** - Ask questions about genes, functions, and genomic regions
- **Intelligent Search** - AI-enhanced gene and sequence searching with automatic results
- **Multi-Provider Support** - OpenAI, Anthropic, Google Gemini, and local LLM integration
- **Smart Navigation** - AI can jump to genes, analyze regions, and provide insights
- **Interactive Chat** - Persistent conversation with genomic context awareness

### 🔬 **Professional Analysis Tools**
- **Sequence Analysis** - GC content, translation, reverse complement operations
- **Feature Annotation** - Create, edit, and manage genomic features interactively
- **Multi-track Visualization** - Synchronized views across different data types
- **Export Capabilities** - FASTA, GenBank, GFF, BED, and protein sequences
- **Search & Filter** - Advanced search with regex support and filtering options

### 📊 **Enhanced User Experience**
- **Modular Architecture** - Clean, maintainable codebase with separated concerns
- **Responsive Design** - Works seamlessly across different screen sizes
- **Keyboard Shortcuts** - Efficient navigation and operation shortcuts
- **Customizable Interface** - Adjustable track heights and panel layouts
- **Cross-Platform** - Native performance on macOS, Windows, and Linux

## 🚀 Installation

### **Download Pre-built Releases**
Download the latest version for your platform from [GitHub Releases](https://github.com/Scilence2022/GenomeAIStudio/releases):

- **macOS**: `Genome-AI-Studio-1.0.0.dmg`
- **Windows**: `Genome-AI-Studio-Setup-1.0.0.exe`
- **Linux**: `Genome-AI-Studio-1.0.0.AppImage`

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

### **2. Configure AI Assistant (Optional)**
- Click **"Options"** → **"Configure LLMs"**
- Add your API key for OpenAI, Anthropic, or Google
- Test the connection and save settings

### **3. Start Exploring**
- Use the search bar to find genes or sequences
- Navigate with zoom controls or position input
- Chat with the AI assistant for intelligent analysis
- Create custom annotations by selecting sequence regions

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

### **AI Integration**
```
User: "Find all DNA polymerase genes"
AI: [Searches genome and displays results]

User: "What's the GC content of this region?"
AI: [Analyzes current view and provides statistics]

User: "Navigate to the lac operon"
AI: [Jumps to lacZYA genes with context]
```

### **Visualization Tracks**
- **🧬 Genes & Features** - Annotations with directional arrows and detailed information
- **🔤 Sequence** - DNA sequence with customizable display density
- **📊 GC Content & Skew** - Dynamic SVG visualization with adaptive window sizing
- **🔬 Variants** - SNPs and mutations with quality information
- **📋 Aligned Reads** - Read coverage and alignment visualization
- **⚗️ Proteins** - Translated sequences and protein features

## 🎮 Usage Examples

### **Basic Navigation**
```bash
# Search for genes
Type "lacZ" in search bar → Press Enter

# Navigate to specific position
Type "chr1:1000-5000" in position input

# Zoom to region
Select region with mouse or use zoom controls
```

### **AI Interaction**
```
Example Queries:
- "Show me all ribosomal genes"
- "What genes are in this region?"
- "Find genes involved in DNA repair"
- "Calculate statistics for current view"
- "Export the current sequence as FASTA"
```

### **Custom Annotations**
1. **Select region**: Click and drag in sequence track
2. **Choose feature type**: Gene, CDS, regulatory element, etc.
3. **Add details**: Name, description, strand orientation
4. **Save**: Feature appears with distinctive styling

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

## 🛠️ Development

### **Architecture Overview**
```
src/
├── main/                    # Electron main process
├── renderer/               # Browser application
│   ├── modules/           # Modular components
│   │   ├── FileManager.js        # File operations
│   │   ├── TrackRenderer.js      # Visualization engine
│   │   ├── NavigationManager.js  # Search & navigation
│   │   ├── ChatManager.js        # AI integration
│   │   └── ConfigManager.js      # Configuration
│   └── renderer-modular.js # Main application
└── assets/                 # Static resources
```

### **Adding New Features**
```javascript
// Example: Add new file format support
// 1. Update FileManager.js
parseCustomFormat(fileContent) {
    // Parsing logic here
}

// 2. Update TrackRenderer.js
createCustomTrack(data) {
    // Visualization logic here
}

// 3. Update AI tools in ChatManager.js
analyzeCustomData(params) {
    // AI analysis logic here
}
```

## 🧪 Testing

### **Sample Data**
The application includes sample genomic data for testing:
- **E. coli genome** - Complete bacterial genome with annotations
- **Example VCF** - Variant calling format examples
- **Test sequences** - Various sequence formats and features

### **Testing Commands**
```bash
# Run application tests
npm test

# Test specific components
npm run test:renderer
npm run test:main

# Integration testing
npm run test:integration
```

## 🔧 Troubleshooting

### **Common Issues**

**AI Assistant not responding**:
- Check API key configuration in Settings
- Verify internet connection for cloud providers
- Test connection using the "Test Connection" button

**File loading problems**:
- Ensure file format is supported
- Check file permissions and accessibility
- Verify file integrity and format compliance

**Performance issues**:
- Reduce visible track count for large genomes
- Use smaller genomic regions for dense annotations
- Close unused browser tabs to free memory

**Configuration problems**:
- Reset configuration: Delete `~/.genome-ai-studio/` directory
- Check file permissions in configuration directory
- Verify JSON syntax in manual configuration edits

### **Getting Help**
- **GitHub Issues**: Report bugs and request features
- **Documentation**: Check markdown files in repository
- **Community**: Join discussions and share experiences
- **Developer Support**: Contact maintainers for technical issues

## 📊 Performance

### **Optimization Features**
- **SVG Rendering**: Hardware-accelerated graphics for smooth performance
- **Lazy Loading**: Components load only when needed
- **Memory Management**: Efficient cleanup and resource management
- **Caching**: Intelligent caching for frequently accessed data

### **System Requirements**
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB for application, additional space for genome data
- **CPU**: Modern multi-core processor recommended
- **Graphics**: Hardware acceleration supported for better performance

## 🚀 Future Roadmap

### **Planned Features**
- **Multi-genome comparison** - Compare multiple genomes side-by-side
- **Advanced AI models** - Integration with specialized biological AI models
- **Cloud integration** - Direct access to genomic databases
- **Collaborative features** - Share annotations and analysis with teams
- **Plugin system** - Third-party extensions and tools

### **Long-term Vision**
- **Real-time collaboration** - Multi-user editing and analysis
- **Advanced analytics** - Machine learning-powered genomic insights
- **Database integration** - Direct connection to NCBI, Ensembl, and other databases
- **Mobile support** - Tablet and mobile device compatibility

## 📝 Contributing

We welcome contributions from the genomics and bioinformatics community!

### **How to Contribute**
1. **Fork the repository** on GitHub
2. **Create a feature branch** from main
3. **Make your changes** with appropriate tests
4. **Submit a pull request** with detailed description

### **Development Guidelines**
- Follow existing code style and patterns
- Add documentation for new features
- Include tests for new functionality
- Update relevant markdown documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Electron** - Cross-platform desktop app framework
- **D3.js** - Data visualization library
- **IGV.js** - Genome visualization components
- **OpenAI/Anthropic** - AI model providers
- **Bioinformatics Community** - Inspiration and feedback

---

**Genome AI Studio** - Intelligent genomic analysis for the modern researcher 🧬🤖 