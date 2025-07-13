# Genome AI Studio User Manual

## Table of Contents

1. [Introduction](#introduction)
2. [Interface Overview](#interface-overview)
3. [File Operations](#file-operations)
4. [Project Management](#project-management)
5. [Genome Visualization](#genome-visualization)
6. [AI Assistant](#ai-assistant)
7. [Analysis Tools](#analysis-tools)
8. [Bioinformatics Tools](#bioinformatics-tools)
9. [Plugin System](#plugin-system)
10. [Advanced Features](#advanced-features)
11. [Settings and Configuration](#settings-and-configuration)
12. [Export and Sharing](#export-and-sharing)
13. [Tips and Tricks](#tips-and-tricks)

## 🧬 Introduction

Welcome to **Genome AI Studio v0.3 beta**, an advanced genome analysis platform that combines powerful visualization, comprehensive analysis tools, and AI-powered assistance to provide a cutting-edge genomic research environment.

### Key Features at a Glance

- **Interactive Genome Visualization** with multiple track types
- **AI-Powered Chat Assistant** for natural language queries
- **Advanced Plugin System** for extensible functionality
- **Comprehensive Analysis Tools** including BLAST, pathway viewers, and protein structure tools
- **Project Management System** with XML-based project files
- **Multi-format Support** for genomic data files

## 🖥️ Interface Overview

### Main Window Layout

The Genome AI Studio interface consists of several key areas:

#### Header Toolbar
- **File Operations**: Load, save, export functions
- **Navigation Controls**: Zoom in/out, position input, search
- **View Controls**: Track visibility, view modes
- **Tool Access**: Quick access to analysis tools

#### Track Visualization Area
- **Genome Tracks**: Visual representation of genomic data
- **Interactive Elements**: Clickable genes, draggable regions
- **Track Management**: Resizable, reorderable tracks

#### Side Panel
- **Gene Details**: Information about selected features
- **Chat Interface**: AI assistant interaction
- **File Browser**: Project files and data management
- **Search Results**: Gene and sequence search results

#### Status Bar
- **Position Information**: Current genome position and coordinates
- **Statistics**: Sequence statistics and metadata
- **System Status**: AI connection, plugin status

### Navigation and Controls

#### Basic Navigation
- **Zoom**: Use + and - buttons, mouse wheel, or keyboard shortcuts (Ctrl+Plus/Minus)
- **Pan**: Click and drag in the track area
- **Jump to Position**: Enter coordinates in the position input field
- **Search**: Use the search bar to find genes or sequences

#### Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| Open File | Ctrl+O |
| Save Project | Ctrl+S |
| Search | Ctrl+F |
| Zoom In | Ctrl+Plus |
| Zoom Out | Ctrl+Minus |
| Open Project | Ctrl+Shift+O |
| KGML Viewer | Ctrl+Shift+K |

## 📁 File Operations

### Supported File Formats

| Format | Type | Description |
|--------|------|-------------|
| **FASTA** | Sequence | Genome and protein sequences |
| **GenBank** | Genome | Complete genomic records with annotations |
| **GFF/GTF** | Annotations | Gene and feature annotations |
| **BED** | Regions | Genomic intervals and features |
| **VCF** | Variants | SNPs and structural variants |
| **SAM/BAM** | Alignments | Read mapping data |
| **WIG** | Tracks | Wiggle format for continuous data |
| **KGML** | Pathways | KEGG pathway markup language |
| **PRJ.GAI** | Projects | Genome AI Studio project files |

### Loading Files

#### Single File Loading
1. Click **"Load File"** in the header toolbar
2. Select file type from dropdown menu:
   - **Genome**: FASTA, GenBank files
   - **Annotations**: GFF, GTF, BED files
   - **Variants**: VCF files
   - **Reads**: SAM, BAM files
   - **Tracks**: WIG files
   - **Any**: Let the system auto-detect format

3. Browse and select your file
4. Wait for processing and visualization

#### Multiple File Loading
1. Load primary genome file first
2. Add additional layers:
   - Annotations overlay gene information
   - Variants show mutations and polymorphisms
   - Reads display sequencing coverage
   - Tracks add custom data layers

### File Management Best Practices

- **Organize files** in project directories
- **Use descriptive filenames** for easy identification
- **Keep related files together** (genome + annotations + variants)
- **Backup important projects** regularly

## 🗂️ Project Management

### Creating Projects

#### New Project Setup
1. Go to **File → New Project**
2. Choose project template:
   - **Blank Project**: Start from scratch
   - **Bacterial Genome**: Template for prokaryotic analysis
   - **Eukaryotic Genome**: Template for complex genomes
   - **Comparative Study**: Multi-genome comparison setup

3. Configure project settings:
   - **Project Name**: Descriptive name for your study
   - **Location**: Directory for project files
   - **Description**: Optional project description

#### Project Structure
```
Documents/GenomeExplorer Projects/
├── ProjectName/
│   ├── data/                    # Raw data files
│   ├── results/                 # Analysis outputs
│   ├── exports/                 # Exported files
│   ├── ProjectName.prj.GAI      # Project file
│   └── metadata.json           # Project metadata
```

### Working with Projects

#### Opening Projects
1. Use **File → Open Project** (Ctrl+Shift+O)
2. Navigate to project directory
3. Select the `.prj.GAI` file
4. Project loads with all associated data

#### Project View Modes
Switch between different project views using the toolbar buttons:

- **Grid View**: Visual thumbnails of files and folders
- **List View**: Detailed list with file information
- **Details View**: Comprehensive table with metadata

#### Project Management Window
Access through **Window → Project Manager** for:
- File organization and management
- Project settings and metadata
- Data import and export
- Project backup and sharing

### Saving and Auto-Save

- **Manual Save**: Ctrl+S saves current project state
- **Auto-Save**: Projects automatically save changes
- **Version Control**: Projects maintain change history
- **Backup**: Regular automated backups created

## 📊 Genome Visualization

### Track Types and Management

#### Gene Tracks
Display genomic features and annotations:
- **Gene Bodies**: Visual representation of gene structures
- **Directional Arrows**: Show gene orientation (forward/reverse)
- **Feature Types**: Different colors for CDS, mRNA, tRNA, etc.
- **Interactive Elements**: Click genes for detailed information

#### Sequence Tracks
Show actual DNA sequence:
- **Automatic Scaling**: Sequence visibility based on zoom level
- **Base Coloring**: Color-coded nucleotides (A=red, T=blue, G=green, C=orange)
- **Translation**: Show amino acid translation in different reading frames

#### GC Content and Skew Tracks
Visualize sequence composition:
- **GC Content**: Percentage of G and C nucleotides
- **GC Skew**: Bias between G and C on each strand
- **Adaptive Windows**: Window size adjusts with zoom level
- **SVG Rendering**: Smooth, scalable visualization

#### Variant Tracks
Display genetic variations:
- **SNPs**: Single nucleotide polymorphisms
- **Indels**: Insertions and deletions
- **Structural Variants**: Large-scale genomic rearrangements
- **Quality Information**: Color-coded by confidence scores

#### Read Tracks
Show sequencing data alignment:
- **Coverage Depth**: Number of reads at each position
- **Read Alignment**: Individual read mapping
- **Quality Scores**: Color-coded mapping quality
- **Mate Pairs**: Paired-end read relationships

### Track Customization

#### Resizing Tracks
- **Drag Handles**: Resize tracks by dragging bottom edge
- **Double-Click**: Auto-fit track to content
- **Keyboard**: Use arrow keys with selected track

#### Reordering Tracks
- **Drag and Drop**: Click and drag tracks to reorder
- **Drop Indicators**: Visual feedback during reordering
- **Track Groups**: Organize related tracks together

#### Track Settings
Right-click any track to access:
- **Height Settings**: Adjust track height
- **Color Options**: Customize track colors
- **Display Options**: Toggle labels, arrows, etc.
- **Data Filtering**: Show/hide specific feature types

### Navigation and Exploration

#### Position Navigation
- **Coordinate Input**: Enter specific genomic coordinates
- **Gene Search**: Jump to genes by name or ID
- **Bookmark Positions**: Save interesting locations
- **Navigation History**: Back and forward through viewed regions

#### Zoom and Scale
- **Zoom Levels**: From chromosome overview to single base resolution
- **Scale Bar**: Shows current resolution and scale
- **Zoom Presets**: Quick zoom to common scales
- **Smooth Zoom**: Gradual zoom with mouse wheel

#### Region Selection
- **Click and Drag**: Select genomic regions for analysis
- **Precise Selection**: Use coordinates for exact regions
- **Multi-Selection**: Select multiple non-contiguous regions
- **Selection Tools**: Various selection modes and tools

## 🤖 AI Assistant

### Setting Up the AI Assistant

#### Configuring AI Providers
1. Go to **Options → Configure LLMs**
2. Choose your AI provider:
   - **OpenAI**: GPT-4, GPT-3.5-turbo
   - **Anthropic**: Claude models
   - **Google**: Gemini Pro
   - **Local LLM**: Ollama or custom endpoints

3. Enter your API credentials
4. Test the connection
5. Save configuration

#### Provider-Specific Setup

**OpenAI Configuration:**
```json
{
  "provider": "openai",
  "apiKey": "your-openai-api-key",
  "model": "gpt-4",
  "baseURL": "https://api.openai.com/v1"
}
```

**Local LLM Configuration:**
```json
{
  "provider": "local",
  "model": "llama3",
  "baseURL": "http://localhost:11434/v1"
}
```

### Using the AI Assistant

#### Natural Language Queries
The AI assistant understands genomic context and can help with:

**Gene Information Queries:**
- "What does the lacZ gene do?"
- "Show me all ribosomal genes"
- "Find genes involved in DNA repair"

**Analysis Requests:**
- "Calculate GC content for this region"
- "Translate this sequence to protein"
- "Find similar sequences using BLAST"

**Navigation Commands:**
- "Go to the lac operon"
- "Show me chromosome 2"
- "Navigate to position 1000000"

**Data Export:**
- "Export current region as FASTA"
- "Save gene annotations as GFF"
- "Download protein sequences"

#### Interactive Analysis
The AI can perform complex analyses:
- **Statistical Calculations**: GC content, sequence composition
- **Sequence Analysis**: Translation, reverse complement
- **Gene Function Prediction**: Based on sequence similarity
- **Pathway Analysis**: Connect genes to metabolic pathways

#### Conversation Features
- **Context Awareness**: AI remembers current genome and region
- **Multi-turn Conversations**: Build on previous queries
- **Thinking Process**: View AI reasoning (when enabled)
- **Conversation History**: Review past interactions

### Advanced AI Features

#### Function Calling
The AI can directly interact with tools:
- **BLAST Searches**: Initiate sequence similarity searches
- **Tool Activation**: Open specialized analysis tools
- **Data Processing**: Perform calculations and transformations
- **Visualization**: Create charts and graphs

#### Plugin Integration
AI assistant works with installed plugins:
- **Plugin Functions**: Call plugin-specific analyses
- **Automated Workflows**: Chain multiple plugin operations
- **Custom Tools**: Access user-developed analysis tools

## 🔬 Analysis Tools

### Sequence Analysis Tools

#### Basic Sequence Operations
- **Reverse Complement**: Generate reverse complement sequences
- **Translation**: Translate DNA to amino acids (all reading frames)
- **Composition Analysis**: Calculate base composition and statistics
- **Pattern Search**: Find specific sequence motifs

#### GC Content Analysis
- **Window-based Calculation**: Sliding window GC content
- **GC Skew Analysis**: Strand bias visualization
- **Comparative Analysis**: Compare GC content across regions
- **Statistical Reports**: Detailed composition statistics

#### ORF Finding
- **Open Reading Frame Detection**: Find potential protein-coding regions
- **Start/Stop Codon Analysis**: Identify translation signals
- **Codon Usage**: Analyze codon bias and optimization
- **Frame Shift Detection**: Identify potential sequencing errors

### Annotation Tools

#### Feature Creation
- **Custom Annotations**: Create user-defined features
- **Gene Prediction**: Identify potential genes
- **Regulatory Elements**: Mark promoters, terminators, etc.
- **Functional Domains**: Annotate protein domains

#### Annotation Import/Export
- **GFF/GTF Support**: Standard annotation formats
- **BED Format**: Genomic interval format
- **Custom Formats**: User-defined annotation schemas
- **Validation Tools**: Check annotation consistency

### Comparative Analysis

#### Multi-Genome Comparison
- **Synteny Analysis**: Compare gene order between genomes
- **Ortholog Detection**: Find corresponding genes
- **Phylogenetic Analysis**: Evolutionary relationships
- **Variation Analysis**: Compare sequence differences

#### Alignment Tools
- **Multiple Sequence Alignment**: Align multiple sequences
- **Pairwise Alignment**: Compare two sequences
- **Alignment Visualization**: View alignment results
- **Conservation Analysis**: Identify conserved regions

## 🧪 Bioinformatics Tools

### BLAST Integration

#### BLAST+ Installation
1. Go to **Tools → Install BLAST+**
2. Choose installation method:
   - **Automatic Installation**: Download and install NCBI BLAST+
   - **Manual Setup**: Configure existing BLAST installation
3. Wait for installation completion
4. Verify installation with test searches

#### Database Management
- **Download Databases**: Get latest NCBI databases
- **Custom Databases**: Create project-specific databases
- **Database Updates**: Keep databases current
- **Storage Management**: Optimize disk space usage

#### BLAST Searches
1. Select sequence for search:
   - **Current Selection**: Use selected genomic region
   - **Gene Sequence**: Search specific gene
   - **Custom Input**: Enter sequence manually

2. Choose search type:
   - **BLASTN**: Nucleotide vs nucleotide
   - **BLASTP**: Protein vs protein
   - **BLASTX**: Nucleotide vs protein (translated)
   - **TBLASTN**: Protein vs nucleotide (translated)

3. Configure search parameters:
   - **Database**: Select target database
   - **E-value**: Set significance threshold
   - **Word Size**: Adjust sensitivity
   - **Filters**: Enable/disable sequence filters

4. View and analyze results:
   - **Hit List**: Ranked list of matches
   - **Alignments**: Detailed sequence alignments
   - **Graphics**: Visual alignment overview
   - **Export Options**: Save results in various formats

### KGML Pathway Viewer

#### Opening Pathway Files
1. Go to **Tools → Visualization Tools → KGML Pathway Viewer** (Ctrl+Shift+K)
2. Load KGML file:
   - **File Browser**: Select local KGML file
   - **KEGG Database**: Download pathway directly
   - **Project Files**: Use pathways in current project

#### Pathway Visualization
- **Interactive Network**: Zoom, pan, and explore pathways
- **Node Information**: Click nodes for detailed information
- **Pathway Statistics**: View network metrics
- **Search Function**: Find specific genes or compounds

#### Pathway Analysis
- **Gene Mapping**: Highlight genes from current genome
- **Expression Overlay**: Show expression data on pathways
- **Pathway Comparison**: Compare pathways between organisms
- **Export Options**: Save pathway images and data

### STRING Protein Networks

#### Network Construction
1. Access **Tools → Bioinformatics Tools → STRING Protein Networks**
2. Input protein information:
   - **Gene Names**: Enter gene identifiers
   - **Protein Sequences**: Use sequence-based search
   - **Current Selection**: Use selected genes from genome

3. Configure network parameters:
   - **Organism**: Select target organism
   - **Confidence Score**: Set interaction confidence threshold
   - **Network Size**: Limit number of interactions

#### Network Analysis
- **Interaction Types**: View different types of protein interactions
- **Clustering**: Identify protein complexes and modules
- **Centrality Analysis**: Find highly connected proteins
- **Pathway Enrichment**: Connect networks to biological pathways

#### Visualization Options
- **Layout Algorithms**: Different network layout methods
- **Node Coloring**: Color by function, expression, etc.
- **Edge Filtering**: Show/hide interaction types
- **Export Formats**: Save as images or network files

### AlphaFold Integration

#### Protein Structure Search
1. Select protein of interest
2. Open **AlphaFold Search** dialog
3. Search by:
   - **UniProt ID**: Direct database lookup
   - **Gene Name**: Search by gene identifier
   - **Sequence**: Similarity-based search

#### Structure Visualization
- **3D Viewer**: Interactive protein structure display
- **Confidence Coloring**: Color by prediction confidence
- **Domain Highlighting**: Emphasize functional domains
- **Comparative View**: Compare multiple structures

#### Structure Analysis
- **Domain Architecture**: Identify protein domains
- **Active Sites**: Highlight functional regions
- **Binding Sites**: Show ligand binding locations
- **Structural Variants**: Compare different conformations

## 🔌 Plugin System

### Plugin Marketplace

#### Browsing Plugins
1. Access **Plugins → Plugin Marketplace**
2. Browse categories:
   - **Analysis Tools**: Bioinformatics algorithms
   - **Visualization**: Custom charts and displays
   - **Database Connectors**: External data sources
   - **Workflow Tools**: Automated pipelines

3. Filter and search:
   - **Category Filter**: Focus on specific types
   - **Search Function**: Find plugins by keyword
   - **Rating Sort**: View highest-rated plugins
   - **Recent Updates**: See newly updated plugins

#### Installing Plugins
1. Click plugin for details:
   - **Description**: What the plugin does
   - **Screenshots**: Visual preview
   - **Requirements**: System and dependency requirements
   - **Reviews**: User feedback and ratings

2. Install plugin:
   - **Install Button**: Download and install
   - **Dependencies**: Auto-install required dependencies
   - **Permissions**: Review and approve permissions
   - **Activation**: Enable plugin after installation

### Plugin Management

#### Installed Plugins
- **Plugin List**: View all installed plugins
- **Status Information**: Active, inactive, or error states
- **Update Notifications**: Alerts for available updates
- **Uninstall Options**: Remove unused plugins

#### Plugin Settings
- **Configuration**: Adjust plugin-specific settings
- **Permissions**: Modify plugin access rights
- **Priority**: Set plugin execution order
- **Integration**: Configure AI assistant integration

### Using Plugins

#### AI Integration
Many plugins integrate with the AI assistant:
- **Natural Language**: Ask AI to use plugin functions
- **Automated Workflows**: Chain plugin operations
- **Context Awareness**: Plugins understand current data

#### Manual Activation
- **Menu Integration**: Plugins add menu items
- **Toolbar Buttons**: Quick access to plugin functions
- **Panels and Dialogs**: Plugin-specific interfaces
- **Keyboard Shortcuts**: Assigned hotkeys for plugins

## ⚙️ Advanced Features

### Custom Annotations

#### Creating Features
1. Select genomic region:
   - **Click and Drag**: Select region in track area
   - **Coordinate Input**: Enter precise coordinates
   - **Gene Selection**: Use existing gene boundaries

2. Choose feature type:
   - **Gene**: Protein-coding gene
   - **CDS**: Coding sequence
   - **Regulatory**: Promoter, enhancer, etc.
   - **Custom**: User-defined feature type

3. Add information:
   - **Name**: Feature identifier
   - **Description**: Functional annotation
   - **Strand**: Forward or reverse orientation
   - **Attributes**: Additional metadata

#### Managing Annotations
- **Edit Features**: Modify existing annotations
- **Delete Features**: Remove unwanted annotations
- **Export Annotations**: Save as GFF/BED files
- **Import Annotations**: Load from external files

### Multi-File Management

#### Loading Multiple Files
- **Primary Genome**: Main sequence file
- **Annotation Layers**: Multiple GFF/GTF files
- **Variant Sets**: Multiple VCF files
- **Read Datasets**: Multiple BAM files

#### File Coordination
- **Automatic Alignment**: Files auto-align to genome coordinates
- **Metadata Management**: Track file relationships
- **Performance Optimization**: Efficient multi-file handling
- **Memory Management**: Smart loading of large files

### Advanced Visualization

#### Track Customization
- **Color Schemes**: Custom color palettes
- **Display Modes**: Different visualization styles
- **Data Filtering**: Show/hide based on criteria
- **Track Groups**: Organize related tracks

#### Export Options
- **Image Export**: PNG, SVG, PDF formats
- **Data Export**: Underlying data in various formats
- **Print Support**: Optimized for printing
- **Web Sharing**: Generate shareable links

## ⚙️ Settings and Configuration

### General Preferences

#### Interface Settings
- **Theme**: Light or dark interface theme
- **Font Size**: Adjust text size for readability
- **Language**: Interface language selection
- **Layout**: Customize panel arrangements

#### Performance Settings
- **Memory Limits**: Adjust memory usage limits
- **Cache Settings**: Configure data caching
- **Rendering Options**: Graphics performance tuning
- **File Handling**: Large file processing options

### AI Assistant Configuration

#### Provider Settings
- **API Keys**: Manage authentication credentials
- **Model Selection**: Choose specific AI models
- **Custom Endpoints**: Configure local or custom APIs
- **Rate Limits**: Adjust API usage limits

#### Conversation Settings
- **History Length**: Number of conversations to keep
- **Context Window**: Amount of context to include
- **Response Format**: How AI responses are displayed
- **Privacy Settings**: Data sharing and privacy options

### File and Project Settings

#### Default Locations
- **Project Directory**: Default location for new projects
- **Data Directory**: Where imported files are stored
- **Export Directory**: Default location for exports
- **Backup Directory**: Automated backup location

#### File Associations
- **Auto-Open**: File types to open automatically
- **Import Preferences**: Default import settings
- **Format Detection**: Automatic format recognition
- **Validation Rules**: File integrity checking

## 📤 Export and Sharing

### Data Export Options

#### Sequence Export
- **FASTA Format**: Standard sequence files
- **GenBank Format**: Rich annotation format
- **Custom Regions**: Export selected regions only
- **Bulk Export**: Multiple sequences at once

#### Annotation Export
- **GFF/GTF Format**: Standard annotation files
- **BED Format**: Genomic interval format
- **Custom Formats**: User-defined export schemas
- **Filtered Export**: Export specific feature types

#### Analysis Results
- **Tables**: CSV, TSV, Excel formats
- **Reports**: PDF, HTML formatted reports
- **Raw Data**: JSON, XML structured data
- **Images**: PNG, SVG, PDF visualizations

### Project Sharing

#### Project Packages
- **Complete Projects**: Bundle all project files
- **Data Subsets**: Share specific datasets
- **Analysis Results**: Share results without raw data
- **Collaborative Features**: Multi-user project access

#### Export Formats
- **ZIP Archives**: Compressed project packages
- **Cloud Storage**: Integration with cloud services
- **Version Control**: Git-compatible exports
- **Metadata Preservation**: Maintain file relationships

### Publication Support

#### Figure Generation
- **High-Resolution Images**: Publication-quality figures
- **Vector Graphics**: Scalable SVG exports
- **Multi-Panel Figures**: Combine multiple visualizations
- **Annotation Tools**: Add labels and annotations

#### Data Citations
- **Provenance Tracking**: Record data sources
- **Version Information**: Track data versions
- **DOI Integration**: Link to published datasets
- **Reproducibility**: Include analysis parameters

## 💡 Tips and Tricks

### Performance Optimization

#### Working with Large Files
- **Enable Streaming**: For files over 100MB
- **Use Simple Mode**: Reduce interface complexity
- **Close Unused Tracks**: Free up memory
- **Regular Cleanup**: Remove temporary files

#### Memory Management
- **Monitor Usage**: Check system resources
- **Adjust Cache**: Optimize cache settings
- **Restart Periodically**: Clear accumulated memory
- **Use SSD Storage**: Improve file access speed

### Workflow Efficiency

#### Keyboard Shortcuts
- **Learn Common Shortcuts**: Speed up frequent tasks
- **Custom Shortcuts**: Define your own hotkeys
- **Context Menus**: Right-click for quick options
- **Search Functions**: Use search to find features quickly

#### Organization Tips
- **Consistent Naming**: Use clear, descriptive names
- **Project Templates**: Create templates for common analyses
- **Regular Backups**: Protect important work
- **Documentation**: Keep notes on analyses and findings

### AI Assistant Best Practices

#### Effective Queries
- **Be Specific**: Clear, detailed questions get better answers
- **Use Context**: Reference current data and selections
- **Build Conversations**: Follow up with related questions
- **Verify Results**: Cross-check AI suggestions

#### Advanced Usage
- **Function Chaining**: Use AI to automate multi-step processes
- **Plugin Integration**: Leverage AI with installed plugins
- **Custom Workflows**: Develop AI-assisted analysis pipelines
- **Learning Mode**: Use AI explanations to learn bioinformatics

---

**This manual covers the core functionality of Genome AI Studio v0.3.0-beta. For the latest features and updates, please refer to the online documentation and release notes.**

*Happy analyzing! 🧬* 