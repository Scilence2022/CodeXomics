# Genome Browser

A modern, cross-platform genome browser built with Electron, featuring an EcoCyc-inspired interface for exploring genomic data.

## Features

### File Format Support
- **FASTA** (.fasta, .fa) - DNA/RNA sequences
- **GenBank** (.gb, .gbk, .genbank) - Complete genome records with annotations
- **GFF/GTF** (.gff, .gtf) - Gene annotation files
- **BED** (.bed) - Genomic regions
- **VCF** (.vcf) - Variant call format
- **BAM/SAM** (.bam, .sam) - Sequence alignment files

### Visualization Features
- **EcoCyc-style genome browser** with multiple tracks
- **Resizable track splitters** for customizing track heights
- **Gene track** showing genes, CDS, and mRNA features with operon detection
- **User-defined features** - Create custom annotations with sequence selection
- **AI Assistant** - Natural language interaction with LLM integration
- **Sequence track** with color-coded nucleotides and interactive selection
- **Ruler track** for position reference
- **GC content visualization** for large regions
- **Variant track** for VCF file visualization
- **Aligned reads track** with multi-row layout
- **Protein track** for CDS translation
- **Interactive gene elements** with hover information
- **Strand-specific visualization** (forward/reverse)
- **Multi-row layouts** preventing feature overlaps

### Navigation & Search
- **Position-based navigation** with zoom controls
- **Sequence search** with reverse complement support
- **Gene/feature search** by name or annotation
- **Chromosome/contig selection**
- **Quick position jumping** (e.g., "chr1:1000-2000")

### Data Analysis
- **Real-time statistics** (sequence length, GC content)
- **Feature counting** (genes, CDS, variants)
- **Sequence export** in FASTA format
- **Copy to clipboard** functionality

## 🤖 AI Assistant

The Genome Browser includes an intelligent AI assistant that provides natural language interaction with your genomic data.

### LLM Configuration
Configure your preferred AI provider via **Options → Configure LLMs**:

- **OpenAI**: GPT-4o, GPT-4o Mini, GPT-4, GPT-3.5 Turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku  
- **Google**: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini Pro
- **Local LLMs**: Ollama, LMStudio, or any OpenAI-compatible API

### Features
- **Natural Language Queries**: "Show me gene ABC123", "What's the GC content of chr1:1000-2000?"
- **Smart Navigation**: Navigate to genomic positions using conversational commands
- **Data Analysis**: Get insights about genomic regions and features
- **Export Assistance**: Generate and export data in various formats
- **Annotation Help**: Create custom annotations with AI guidance

### Quick Start
1. Click **Options** → **Configure LLMs** in the header
2. Choose your provider and enter API credentials
3. Test the connection and save
4. Click the robot icon 🤖 in the toolbar to start chatting

For detailed setup and usage instructions, see [LLM_CHAT_INTEGRATION.md](LLM_CHAT_INTEGRATION.md).

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm (comes with Node.js)

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd electron-GenomeViewer

# Install dependencies
npm install

# Start the application
npm start
```

## Usage

### Loading Files
1. Click "Open File" or use Ctrl/Cmd+O
2. Select a supported genome file
3. The file will be parsed and displayed automatically

### Navigation
- **Zoom**: Use zoom in/out buttons or mouse wheel
- **Pan**: Use Previous/Next buttons or arrow keys
- **Jump to position**: Enter coordinates in the position field
- **Search**: Use the search function to find sequences

### Viewing Genes (GenBank files)
- Genes are displayed as colored rectangles in the gene track
- Green: genes, Blue: CDS, Yellow: mRNA
- Hover over genes to see detailed information
- Reverse strand genes have diagonal stripes and left-pointing arrows

### Creating User-Defined Features
- **Add Features toolbar** - Quick access buttons for common feature types (Gene, CDS, rRNA, tRNA, Comment/Note)
- **More Features dropdown** - Access additional types (Promoter, Terminator, Regulatory, Other)
- **Sequence selection** - Click and drag in the sequence panel to select regions
- **Feature creation modal** - Fill in details like name, type, position, strand, and description
- **Visual distinction** - User-created features appear with dashed borders and green highlighting
- **Persistent during session** - Added features remain until browser restart

### AI Assistant & Natural Language Interaction
- **Smart Chat Interface** - Modern chat UI with typing indicators and connection status
- **Natural Language Commands** - "Navigate to chr1:1000-2000", "Find gene recA", "What's the GC content?"
- **MCP Integration** - Model Context Protocol for seamless LLM communication
- **Comprehensive Tools** - Navigation, search, analysis, annotation, and export capabilities
- **Real-time Interaction** - Live updates and state synchronization with the browser
- **Multiple LLM Support** - Compatible with OpenAI, Anthropic, and custom models
- **Quick Start** - Run `npm run start-with-mcp` to launch with AI features enabled

### Resizing Tracks
- **Track splitters** appear between each visible track
- **Drag splitters** up/down to adjust individual track heights
- **Keyboard navigation**: Tab to focus splitter, Arrow keys to resize
- **Minimum heights** ensure tracks remain functional
- See [TRACK_SPLITTERS.md](TRACK_SPLITTERS.md) for detailed documentation

## Documentation

For detailed information about specific features:
- [LLM_CHAT_INTEGRATION.md](LLM_CHAT_INTEGRATION.md) - AI Assistant and MCP integration
- [USER_DEFINED_FEATURES.md](USER_DEFINED_FEATURES.md) - Creating custom annotations
- [TRACK_SPLITTERS.md](TRACK_SPLITTERS.md) - Track height customization
- [SEARCH_FUNCTIONALITY.md](SEARCH_FUNCTIONALITY.md) - Search and navigation
- [SEARCH_RESULTS_PANEL.md](SEARCH_RESULTS_PANEL.md) - Search results interface
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Technical implementation details

### Sample Data
The `sample_data/` folder contains:
- `sample_genome.fasta` - Test FASTA file
- `ecoli_MG1655.gb` - E. coli K-12 MG1655 complete genome (GenBank format)

## Architecture

### Main Process (`src/main.js`)
- Electron main process
- File system operations
- Menu system and IPC handlers

### Renderer Process (`src/renderer/`)
- **index.html** - Application UI structure
- **styles.css** - EcoCyc-inspired styling
- **renderer.js** - Core genome browser logic

### Key Components
- **GenomeBrowser class** - Main application controller
- **File parsers** - FASTA, GenBank, GFF, BED, VCF support
- **Visualization engine** - Track-based genome display
- **Search engine** - Sequence and annotation search

## File Format Details

### GenBank Support
- Full GenBank format parsing
- Extracts sequence data and all annotations
- Supports genes, CDS, mRNA, and other features
- Handles both forward and reverse strand features
- Parses qualifiers (gene names, products, etc.)

### FASTA Support
- Multi-sequence FASTA files
- Automatic sequence detection
- Chromosome/contig selection

### Annotation Files
- GFF/GTF: Gene annotation import
- BED: Genomic region visualization
- VCF: Variant display and analysis

## Development

### Building for Distribution
```bash
# Build for current platform
npm run build

# Build for all platforms
npm run build:all
```

### Adding New Features
1. File parsers: Add to `parseFile()` method
2. Visualization: Extend track creation methods
3. UI components: Update HTML/CSS as needed

## Keyboard Shortcuts
- **Ctrl/Cmd+O**: Open file
- **Ctrl/Cmd+F**: Search
- **Ctrl/Cmd+G**: Go to position
- **Arrow keys**: Navigate left/right
- **+/-**: Zoom in/out
- **Home**: Reset zoom

## Troubleshooting

### Common Issues
1. **File not loading**: Check file format and size
2. **No genes visible**: Ensure GenBank file has feature annotations
3. **Performance issues**: Try smaller regions or files

### Supported Platforms
- Windows 10/11
- macOS 10.14+
- Linux (Ubuntu 18.04+)

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License
MIT License - see LICENSE file for details 