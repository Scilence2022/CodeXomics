# Electron Genome Browser

A modern, cross-platform genome browser built with Electron, featuring an EcoCyc-inspired interface for exploring genomic data with AI-powered natural language interaction.

## ✨ Key Features

### 🧬 **Advanced Genome Visualization**
- **Dynamic SVG-based GC Content/Skew** - Crisp, scalable visualization with adaptive window sizing
- **Interactive Tracks** - Genes, sequences, variants, reads, and proteins with resizable heights
- **Multi-format Support** - FASTA, GenBank, GFF/GTF, BED, VCF, BAM/SAM files
- **Real-time Navigation** - Smooth zooming, panning, and position jumping
- **User-defined Features** - Create custom annotations with sequence selection

### 🤖 **AI-Powered Assistant** 
- **Natural Language Interface** - Ask questions like "find DNA polymerase" or "show GC content"
- **Multi-LLM Support** - OpenAI GPT-4o, Anthropic Claude 3.5, Google Gemini, Local LLMs
- **Smart Search Functions** - Intelligent distinction between text-based and position-based searches
- **Real-time Analysis** - Live interaction with genomic data and instant responses
- **Comprehensive Tools** - Navigation, analysis, annotation, and export capabilities

### 🔍 **Enhanced Search & Navigation**
- **Dual Search Modes** - Text-based gene search AND position-based proximity search
- **Smart Results Panel** - Automatic display of search results with one-click navigation  
- **Sequence Search** - Find DNA patterns with reverse complement support
- **Visual Selection** - Click-and-drag sequence selection for precise annotations

## File Format Support

| Format | Extension | Features |
|--------|-----------|----------|
| **FASTA** | .fasta, .fa | DNA/RNA sequences with multi-contig support |
| **GenBank** | .gb, .gbk, .genbank | Complete genome records with rich annotations |
| **GFF/GTF** | .gff, .gtf, .gff3 | Gene annotation files with feature hierarchies |
| **BED** | .bed | Genomic regions and interval data |
| **VCF** | .vcf | Variant call format with SNP/INDEL support |
| **BAM/SAM** | .bam, .sam | Sequence alignments with quality scores |

## Visualization Features

### **Track System**
- **Gene Track** - Features with operon detection, strand visualization, and user annotations
- **Sequence Track** - Color-coded nucleotides with dynamic sizing and selection
- **GC Content Track** - Dynamic SVG visualization with adaptive window sizing and gradients
- **Variant Track** - SNP/INDEL display with quality information
- **Reads Track** - Multi-row alignment visualization
- **Protein Track** - Translated CDS sequences
- **Ruler Track** - Position reference with zoom-adaptive scaling

### **Enhanced GC Content Visualization**
- **SVG-Based Rendering** - Crisp, scalable graphics that look perfect at any zoom level
- **Dynamic Calculation** - Adaptive window sizing (10bp-5000bp) based on current zoom
- **Dual Visualization** - GC Content (upper, green gradients) + GC Skew (lower, amber/red)
- **Interactive Tooltips** - Rich information including position, percentages, and base counts
- **Professional Gradients** - Color-coded visualization for easy interpretation

### **Resizable Track Splitters**
- **Drag-and-Drop** - Adjust track heights by dragging splitters between tracks
- **Keyboard Navigation** - Tab to focus, arrow keys to resize, space to reset
- **Minimum Heights** - Ensures tracks remain functional at all sizes
- **Visual Feedback** - Clear resize cursors and smooth animations

## 🤖 AI Assistant Setup

### **Quick Start**
1. **Configure Provider**: Options → Configure LLMs
2. **Choose Service**: OpenAI, Anthropic, Google, or Local LLM
3. **Enter Credentials**: API key and model selection
4. **Test Connection**: Verify setup works correctly
5. **Start Chatting**: Click the robot icon 🤖 in toolbar

### **Supported Providers**
| Provider | Models | Setup |
|----------|--------|-------|
| **OpenAI** | GPT-4o, GPT-4o Mini, GPT-4, GPT-3.5 | [Get API Key](https://platform.openai.com/api-keys) |
| **Anthropic** | Claude 3.5 Sonnet, Opus, Haiku | [Get API Key](https://console.anthropic.com/) |
| **Google** | Gemini 2.0 Flash, 1.5 Pro, 1.5 Flash | [Get API Key](https://aistudio.google.com/app/apikey) |
| **Local** | Ollama, LMStudio, etc. | Configure local endpoint |

### **Natural Language Commands**
```
"Find DNA polymerase genes"              → Searches annotations
"Navigate to chr1:1000-2000"            → Navigation
"What's near position 12345?"           → Proximity search  
"Show GC content for this region"       → Analysis
"Create a gene annotation here"         → Feature creation
"Export this region as FASTA"          → Data export
```

## Installation & Usage

### **Prerequisites**
- Node.js (v16 or higher)
- npm (included with Node.js)

### **Setup**
```bash
# Clone repository
git clone [repository-url]
cd electron-GenomeViewer

# Install dependencies
npm install

# Start application
npm start

# Start with AI features
npm run start-with-mcp
```

### **Loading Files**
1. Click **"Open File"** or use `Ctrl/Cmd+O`
2. Select genome file (FASTA, GenBank, GFF, etc.)
3. File automatically parsed and visualized
4. Use toolbar to toggle tracks and configure display

### **Navigation**
- **Zoom**: Mouse wheel, +/- buttons, or toolbar controls
- **Pan**: Arrow keys, Previous/Next buttons, or drag in tracks
- **Jump**: Enter coordinates in position field (`chr1:1000-2000`)
- **Search**: Find genes by name or DNA sequences

### **Creating Annotations**
1. **Select Sequence**: Click and drag in sequence track to select region
2. **Choose Feature Type**: Use "Add Features" toolbar buttons
3. **Fill Details**: Enter name, type, strand, and description in modal
4. **Save**: Feature appears with green highlighting and dashed border

## Search Functionality

### **Text-Based Search** (for gene names, products)
- **Gene Names**: `lacZ`, `recA`, `dnaA`
- **Products**: `DNA polymerase`, `ribosomal protein` 
- **Locus Tags**: `b0344`, `JW0335`
- **Results**: Displayed in left sidebar with one-click navigation

### **Position-Based Search** (for genomic coordinates)  
- **Near Position**: "What's around position 50000?"
- **Coordinate Range**: "Features between 1000 and 5000"
- **Distance**: Configurable search radius (default 5000bp)

### **Sequence Pattern Search**
- **DNA Sequences**: `ATGCGATCG`, `GAATTC` (EcoRI site)
- **Reverse Complement**: Optional inclusion of reverse strand
- **Case Sensitivity**: Configurable matching precision

## Architecture

### **Main Process** (`src/main.js`)
- Electron application bootstrap
- File system operations and security
- Menu system and IPC communication

### **Renderer Process** (`src/renderer/`)
- **Core Application**: `renderer-modular.js` - Main genome browser controller
- **Modular Components**: Separate modules for file handling, visualization, navigation
- **AI Integration**: `ChatManager.js`, `LLMConfigManager.js` for AI functionality
- **Configuration**: `ConfigManager.js` for persistent settings management

### **Key Modules**
| Module | Purpose |
|--------|---------|
| `FileManager.js` | File loading, parsing, format detection |
| `TrackRenderer.js` | Visualization engine with enhanced GC content |
| `NavigationManager.js` | Search, navigation, zoom controls |
| `ChatManager.js` | AI assistant with corrected function calling |
| `LLMConfigManager.js` | Multi-provider LLM configuration |
| `ConfigManager.js` | Persistent configuration management |

## Recent Improvements

### **🔧 Fixed Search Function Calling**
- **Corrected LLM behavior**: Now properly uses `search_features` for text-based searches
- **Clear function distinction**: Separated text search from position-based proximity search
- **Enhanced system prompts**: Better guidance for AI function selection
- **Improved examples**: More explicit function call examples and use cases

### **📊 Enhanced GC Content Visualization**
- **SVG-based rendering**: Replaced fuzzy canvas with crisp vector graphics
- **Dynamic calculations**: Adaptive window sizing based on zoom level
- **Professional gradients**: Green for GC content, amber/red for GC skew
- **Interactive tooltips**: Rich information with position and base counts
- **Performance optimized**: Hardware-accelerated rendering

### **⚙️ Improved Function Structure**  
- **Centralized configuration**: Unified ConfigManager across all modules
- **Better error handling**: Graceful degradation and user feedback
- **Code organization**: Enhanced modular architecture with clear separation
- **Memory management**: Optimized resource usage and cleanup

## Documentation

For detailed information about specific features:

| Document | Description |
|----------|-------------|
| [LLM_CHAT_INTEGRATION.md](LLM_CHAT_INTEGRATION.md) | Complete AI assistant setup and usage |
| [SEARCH_FUNCTIONALITY.md](SEARCH_FUNCTIONALITY.md) | Enhanced search capabilities and options |
| [USER_DEFINED_FEATURES.md](USER_DEFINED_FEATURES.md) | Creating custom genomic annotations |
| [TRACK_SPLITTERS.md](TRACK_SPLITTERS.md) | Resizable track height customization |
| [SEARCH_RESULTS_PANEL.md](SEARCH_RESULTS_PANEL.md) | Search results interface and navigation |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | Technical implementation details |

### **Sample Data**
The `sample_data/` folder contains test files:
- `sample_genome.fasta` - Test FASTA sequence
- `ecoli_MG1655.gb` - E. coli K-12 MG1655 complete genome

## Development

### **Building for Distribution**
```bash
npm run build        # Build for current platform
npm run build:all    # Build for all platforms
```

### **Adding New Features**
1. **File Formats**: Extend `FileManager.js` parsers
2. **Visualizations**: Add track types to `TrackRenderer.js` 
3. **AI Tools**: Implement new functions in `ChatManager.js`
4. **UI Components**: Update HTML/CSS and event handlers

### **Code Quality**
- **ESLint configuration** for consistent coding standards
- **Modular architecture** for maintainable code organization
- **Comprehensive error handling** with user-friendly feedback
- **Performance optimization** for large genomic datasets

## Contributing

We welcome contributions! Please see our contribution guidelines for:
- Code style and standards
- Testing requirements  
- Documentation updates
- Feature request process

## License

[Specify your license here]

---

**Built with** ❤️ **using Electron, modern web technologies, and AI integration for the next generation of genomic data exploration.** 