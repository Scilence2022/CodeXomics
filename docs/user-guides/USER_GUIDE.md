# CodeXomics User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Getting Started](#getting-started)
4. [Core Features](#core-features)
5. [AI Assistant](#ai-assistant)
6. [External Tools](#external-tools)
7. [Benchmark Testing](#benchmark-testing)
8. [Advanced Features](#advanced-features)
9. [Troubleshooting](#troubleshooting)
10. [FAQ](#faq)

---

## Introduction

CodeXomics is an AI-powered bioinformatics analysis platform that combines traditional genomic analysis tools with cutting-edge multi-agent AI systems. This guide will help you get the most out of CodeXomics.

### What Can CodeXomics Do?

- 🧬 **Genome Visualization** - Interactive visualization of genomes, genes, and annotations
- 🤖 **AI-Powered Analysis** - Natural language queries powered by multiple AI agents
- 🔬 **Protein Analysis** - Structure prediction, network analysis, and pathway visualization
- 📊 **Data Management** - Project-based organization with support for multiple file formats
- 🔌 **Extensible Platform** - Plugin system and external tool integration
- 📈 **Benchmark Testing** - Comprehensive AI performance evaluation

---

## Installation

### Pre-built Binaries

Download the latest version (v0.522beta) from the [GitHub Releases](https://github.com/Scilence2022/CodeXomics/releases/tag/v0.522beta) page.

#### macOS
1. Download `CodeXomics-0.522.0-beta-x64.dmg` (Intel) or `CodeXomics-0.522.0-beta-arm64.dmg` (Apple Silicon)
2. Open the DMG file
3. Drag CodeXomics to your Applications folder
4. Right-click and select "Open" the first time (macOS security)

#### Windows
1. Download `CodeXomics Setup 0.522.0-beta.exe` (installer) or portable version
2. Run the installer and follow the prompts
3. Launch from Start Menu or Desktop shortcut

#### Linux
1. Download `CodeXomics-0.522.0-beta.AppImage` or `.deb` package
2. For AppImage: `chmod +x CodeXomics-0.522.0-beta.AppImage && ./CodeXomics-0.522.0-beta.AppImage`
3. For Debian: `sudo dpkg -i codexomics_0.522.0-beta_amd64.deb`

### Building from Source

```bash
# Clone the repository
git clone https://github.com/Scilence2022/CodeXomics.git
cd CodeXomics

# Install dependencies
npm install

# Run in development mode
npm start

# Build for your platform
npm run build:mac     # macOS
npm run build:win     # Windows
npm run build:linux   # Linux
```

---

## Getting Started

### First Launch

When you first launch CodeXomics, you'll see the main interface with:

- **Header Bar** - File operations, tools menu, and settings
- **Genome Viewer** - Central visualization area
- **ChatBox** - AI assistant interface (right sidebar)
- **Gene Details** - Information panel (left sidebar)

### Quick Start Workflow

#### 1. Configure AI Models (Essential)

Before using AI features, configure your LLM providers:

```
Options → Configure LLMs
```

**Add API Keys:**
- **OpenAI**: Get key from https://platform.openai.com/api-keys
- **Anthropic**: Get key from https://console.anthropic.com/
- **Google**: Get key from https://ai.google.dev/
- **SiliconFlow**: Get key from https://siliconflow.cn/

**Configure Multi-Agent Settings:**
- Enable multi-agent mode for complex analysis
- Set coordinator and worker models
- Configure collaboration parameters

**Test Connection:**
- Click "Test Connection" for each provider
- Verify successful connection before proceeding

#### 2. Load Your First Genome

```
File → Load File → Select FASTA/GenBank file
```

**Supported Formats:**
- **FASTA** (.fasta, .fa, .fna) - Sequence data
- **GenBank** (.gb, .gbk) - Annotated sequences
- **GFF/GTF** (.gff, .gtf) - Feature annotations
- **BED** (.bed) - Genomic intervals
- **VCF** (.vcf) - Variant data
- **BAM/SAM** (.bam, .sam) - Read alignments

**Sample Data:**
CodeXomics includes E. coli genome and pathway data for testing.

#### 3. Start Exploring

**Navigate the Genome:**
- Use the position slider to pan
- Enter coordinates (e.g., "1000-5000") in the position input
- Click zoom buttons (+/-) to adjust view scale
- Right-click and drag to select regions

**Search for Genes:**
- Type gene name in search box (e.g., "lacZ")
- Press Enter to jump to gene location
- View detailed information in left sidebar

**Ask the AI:**
- Type questions in ChatBox (e.g., "What does the lacZ gene do?")
- AI will use appropriate tools to answer
- View conversation history and AI reasoning process

---

## Core Features

### Genome Visualization

#### Tracks

**Gene Track** 🧬
- Shows annotated genes and features
- Color-coded by type (CDS, tRNA, rRNA, etc.)
- Directional arrows indicate strand
- Click to view detailed information

**Sequence Track** 🔤
- Displays DNA sequence
- Adaptive density based on zoom level
- Color-coded nucleotides (A, T, G, C)

**GC Content & Skew Track** 📊
- Dynamic SVG visualization
- Adaptive window sizing
- Shows GC percentage and skew values
- Useful for identifying genomic features

**Variant Track** 🔬
- Shows SNPs and mutations from VCF files
- Quality scores and annotations
- Filter by type and quality

**Read Alignment Track** 📋
- Visualizes BAM/SAM alignments
- Coverage depth display
- Mismatch highlighting

**Protein Track** ⚗️
- Translated sequences
- Protein features and domains
- Link to structure prediction

#### Track Controls

**Resize Tracks:**
- Click and drag track headers to adjust height
- Settings persist across sessions

**Reorder Tracks:**
- Drag track headers to reorder
- Customize your preferred layout

**Toggle Tracks:**
- Click eye icon to show/hide tracks
- Right-click for track-specific options

### Project Management

#### Creating Projects

```
File → New Project
```

**Project Structure:**
```
Documents/GenomeExplorer Projects/
└── MyProject/
    ├── data/                    # Project data files
    ├── MyProject.prj.GAI        # Project configuration
    └── metadata.json            # Project metadata
```

**Project Files Include:**
- Genome sequences and annotations
- AI conversation history
- Custom annotations and features
- Visualization preferences
- Analysis results

#### Project View Modes

**Grid View** - Visual thumbnail layout
**List View** - Compact file listing
**Details View** - Full metadata display

Switch modes using: `View → Grid/List/Details`

### File Operations

#### Loading Files

**Single File:**
```
File → Load File → Select file
```

**Multiple Files:**
```
File → Load Multiple Files → Select annotation files
```

**Drag and Drop:**
- Drag files directly onto the genome viewer
- Automatically detects file type
- Prompts for additional information if needed

#### Exporting Data

**Export Sequences:**
```
Tools → Export → FASTA/GenBank/Protein
```

**Export Features:**
```
Tools → Export → GFF/BED
```

**Export Analysis Results:**
- AI conversation logs
- Benchmark test results
- Network analysis data
- Pathway visualizations

---

## AI Assistant

### ChatBox Interface

The ChatBox is your interface to CodeXomics' multi-agent AI system.

#### Basic Queries

**Gene Information:**
```
"What does the lacZ gene do?"
"Find all DNA polymerase genes"
"Show me genes involved in DNA repair"
```

**Sequence Analysis:**
```
"Calculate GC content of this region"
"Find ORFs in this sequence"
"Analyze codon usage for lacZ"
```

**Navigation:**
```
"Jump to position 1000"
"Show me the lac operon region"
"Find genes between 1000 and 5000"
```

#### Advanced Multi-Agent Queries

**Complex Analysis:**
```
"Perform a comprehensive analysis of the lac operon including:
- Gene annotation
- Protein structure prediction
- Pathway integration
- Regulatory elements"
```

**Comparative Analysis:**
```
"Compare GC content across multiple genomic regions"
"Find similar genes in other organisms"
```

**Workflow Automation:**
```
"Load E. coli genome, find ribosomal genes, export to FASTA"
"Analyze all genes in region 1000-10000 and generate summary"
```

### Understanding AI Responses

**Thinking Process:**
- Click "Show Thinking" to see AI reasoning
- Understand tool selection decisions
- View intermediate steps

**Tool Calls:**
- AI automatically selects appropriate tools
- View which tools were used
- See tool parameters and results

**Multi-Agent Coordination:**
- Coordinator assigns tasks to specialized agents
- Workers execute specific analysis
- Results are integrated and presented

### AI Configuration

**Model Selection:**
- Choose different models for different tasks
- Coordinator vs Worker model configuration
- Balance cost vs performance

**Temperature Settings:**
- Lower (0.0-0.3): Precise, factual responses
- Medium (0.4-0.7): Balanced creativity and accuracy
- Higher (0.8-1.0): More creative, exploratory

**Context Management:**
- AI maintains conversation context
- Reference previous queries
- Build on earlier analysis

---

## External Tools

CodeXomics integrates with several powerful external tools.

### ProGenFixer 🔧

**Purpose:** Protein engineering and sequence optimization

**Access:**
```
Tools → External Tools → ProGenFixer
Keyboard: Cmd/Ctrl+Shift+P
```

**Use Cases:**
- Optimize protein sequences
- Fix problematic sequences
- Predict stability
- Design mutations

### Deep Gene Research 🧬

**Purpose:** Advanced gene analysis and research

**Access:**
```
Tools → External Tools → Deep Gene Research
Keyboard: Cmd/Ctrl+Shift+D
```

**Features:**
- Comprehensive gene databases
- Literature mining
- Functional annotation
- Pathway integration

### CHOPCHOP 🔬

**Purpose:** CRISPR design and analysis

**Access:**
```
Tools → External Tools → CHOPCHOP
Keyboard: Cmd/Ctrl+Shift+C
```

**Capabilities:**
- sgRNA design
- Off-target prediction
- Primer design
- Validation

### KGML Pathway Viewer 🛤️

**Purpose:** KEGG pathway visualization

**Access:**
```
Tools → Visualization Tools → KGML Pathway Viewer
Keyboard: Cmd/Ctrl+Shift+K
```

**Features:**
- Interactive pathway maps
- Gene highlighting
- Metabolite information
- Pathway export

### STRING Networks 🔗

**Purpose:** Protein-protein interaction analysis

**Access:**
```
Tools → Bioinformatics Tools → STRING Networks
```

**Analysis:**
- Interaction networks
- Functional enrichment
- Cluster analysis
- Network export

---

## Benchmark Testing

Evaluate AI performance with comprehensive benchmark suites.

### Opening Benchmark Interface

```
Benchmark & Debug → Open Benchmark
```

### Test Categories

**1. Navigation Tests** (4 tests)
- Browser navigation
- Position jumping
- Gene search
- Region selection

**2. Analysis Tests** (5 tests)
- Sequence analysis
- GC content calculation
- Codon usage
- ORF finding

**3. Data Loading Tests** (3 tests)
- File loading
- Format parsing
- Data validation

**4. Search Tests** (4 tests)
- Gene search
- Feature search
- Database queries
- Result validation

**5. External Database Tests** (3 tests)
- API integration
- Data retrieval
- Link validation

**6. Workflow Tests** (3 tests)
- Multi-step analysis
- Tool coordination
- Result integration

### Running Tests

**Automatic Tests:**
1. Select test suites
2. Configure LLM settings
3. Click "Run Selected Tests"
4. Monitor real-time progress
5. Review results

**Manual Tests:**
1. Follow step-by-step instructions
2. Complete verification checklist
3. Provide scores (0-10)
4. Add comments
5. Submit evaluation

### Viewing Results

**Progress Tracking:**
- Real-time progress bars
- Test status indicators
- Success/failure counts

**Detailed Reports:**
- Individual test results
- LLM interaction logs
- Performance metrics
- Error analysis

**Export Options:**
- CSV export
- JSON export
- HTML reports
- LLM conversation logs

---

## Advanced Features

### Conversation Evolution v2

Track AI reasoning and decision-making across conversations.

**Features:**
- Conversation state tracking
- Decision point analysis
- Tool usage patterns
- Performance metrics

**Access:**
```
Tools → Conversation Evolution
```

### Plugin System

Extend CodeXomics with community plugins.

**Plugin Marketplace:**
```
Plugins → Marketplace
```

**Available Plugins:**
- Biological Networks
- Comparative Genomics
- Metabolic Pathways
- Structural Genomics
- Population Genomics

**Installing Plugins:**
1. Browse marketplace
2. Click "Install" on desired plugin
3. Plugin automatically integrates
4. Access through Tools menu

### MCP Integration

Model Context Protocol enables seamless tool integration.

**Benefits:**
- Standardized tool interfaces
- Cross-platform compatibility
- Enhanced AI tool selection
- Better error handling

### Custom Annotations

Create your own genomic features.

**Adding Features:**
1. Select sequence region
2. Right-click → "Create Feature"
3. Enter feature details
4. Save to project

**Feature Types:**
- CDS (Coding Sequence)
- Gene
- Regulatory Element
- Repeat Region
- Custom Type

---

## Troubleshooting

### Common Issues

#### AI Not Responding

**Symptoms:** ChatBox doesn't respond to queries

**Solutions:**
1. Check API key configuration (Options → Configure LLMs)
2. Verify internet connection
3. Test connection using "Test Connection" button
4. Check API quota/billing
5. Try a different model provider

#### File Won't Load

**Symptoms:** Error loading genome file

**Solutions:**
1. Verify file format is supported
2. Check file isn't corrupted (open in text editor)
3. Ensure file permissions allow reading
4. Try smaller file first
5. Check console for specific errors (View → Developer Tools)

#### Slow Performance

**Symptoms:** Interface feels sluggish

**Solutions:**
1. Reduce number of visible tracks
2. Close unused external tool windows
3. Clear conversation history
4. Restart application
5. Check system resources (RAM, CPU)

#### Benchmark Tests Failing

**Symptoms:** Tests don't complete or fail unexpectedly

**Solutions:**
1. Verify test data files are accessible
2. Check LLM configuration
3. Ensure working directory is correct
4. Review test logs for specific errors
5. Try individual tests instead of full suite

### Getting Help

**Check Documentation:**
- This user guide
- Developer guide
- API reference
- Fix summaries in docs/

**Report Issues:**
- GitHub Issues: https://github.com/Scilence2022/CodeXomics/issues
- Include: Version, OS, steps to reproduce, error messages

**Contact:**
- Email: songlf@tib.cas.cn
- GitHub Discussions: https://github.com/Scilence2022/CodeXomics/discussions

---

## FAQ

### General Questions

**Q: What file formats are supported?**

A: FASTA, GenBank, GFF/GTF, BED, VCF, BAM/SAM, KGML, WIG, and .prj.GAI project files.

**Q: Do I need an API key to use CodeXomics?**

A: AI features require API keys from providers (OpenAI, Anthropic, etc.). Basic visualization and analysis tools work without API keys.

**Q: Can I use local LLMs?**

A: Yes! Configure a local LLM endpoint (e.g., Ollama) in LLM settings.

**Q: Is my data sent to AI providers?**

A: Only your queries and relevant context are sent to AI providers. Your genome data stays local unless explicitly requested in a query.

### Technical Questions

**Q: How much RAM do I need?**

A: Minimum 6GB, recommended 12GB for large genomes and multi-agent mode.

**Q: Can I run CodeXomics on older computers?**

A: It depends on the genome size and features used. Try reducing active tracks and disabling multi-agent mode.

**Q: How do I update CodeXomics?**

A: Download the latest version from GitHub Releases and install over the existing version.

**Q: Where are my projects saved?**

A: By default in `Documents/GenomeExplorer Projects/`. You can change this in settings.

### Feature Questions

**Q: Can I compare multiple genomes?**

A: Yes, through the Comparative Genomics plugin and multi-file loading.

**Q: How do I export my analysis results?**

A: Use Tools → Export or save the entire project (.prj.GAI format).

**Q: Can I create my own plugins?**

A: Yes! See the Developer Guide for plugin development instructions.

**Q: How accurate is the AI analysis?**

A: AI provides helpful insights but should be validated. Use benchmark tests to evaluate performance for your specific use cases.

---

## Next Steps

**Explore More:**
- [Developer Guide](../developer-guides/DEVELOPER_GUIDE.md) - Create plugins and contribute
- [API Reference](../api-docs/) - Technical documentation
- [Release Notes](../release-notes/) - What's new in each version

**Join the Community:**
- GitHub Discussions
- Report bugs
- Request features
- Share your analysis workflows

**Stay Updated:**
- Star the repository
- Watch for releases
- Follow changelog

---

**CodeXomics v0.522beta** - Intelligent Bioinformatics Analysis with Multi-Agent AI

Made with ❤️ by the CodeXomics Team
