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
- **Sequence track** with color-coded nucleotides
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

### Resizing Tracks
- **Track splitters** appear between each visible track
- **Drag splitters** up/down to adjust individual track heights
- **Keyboard navigation**: Tab to focus splitter, Arrow keys to resize
- **Minimum heights** ensure tracks remain functional
- See [TRACK_SPLITTERS.md](TRACK_SPLITTERS.md) for detailed documentation

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