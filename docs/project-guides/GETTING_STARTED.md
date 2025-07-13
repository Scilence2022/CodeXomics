# Getting Started with Genome AI Studio

Welcome to **Genome AI Studio v0.3 beta**! This guide will help you get up and running with the platform quickly and efficiently.

## 📋 Prerequisites

### System Requirements
- **Operating System**: macOS 10.14+, Windows 10+, or Linux (Ubuntu 18.04+)
- **Memory**: 6GB RAM minimum, 12GB recommended
- **Storage**: 1GB for application, additional space for data and plugins
- **Network**: Internet connection for AI services and database access

### Optional Requirements
- **AI Services**: API keys for OpenAI, Anthropic, or Google Gemini (for AI chat features)
- **BLAST+**: For sequence alignment tools (can be installed through the app)

## 🚀 Installation

### Option 1: Download Pre-built Release (Recommended)

1. **Download the latest release**:
   - Visit the [GitHub Releases page](https://github.com/Scilence2022/GenomeAIStudio/releases)
   - Download the appropriate version for your platform:
     - **macOS**: `Genome-AI-Studio-0.3.0-beta.dmg`
     - **Windows**: `Genome-AI-Studio-Setup-0.3.0-beta.exe`
     - **Linux**: `Genome-AI-Studio-0.3.0-beta.AppImage`

2. **Install the application**:
   - **macOS**: Open the DMG file and drag the app to Applications
   - **Windows**: Run the installer and follow the setup wizard
   - **Linux**: Make the AppImage executable and run it

### Option 2: Build from Source

1. **Clone the repository**:
```bash
git clone https://github.com/Scilence2022/GenomeAIStudio.git
cd GenomeAIStudio
```

2. **Install dependencies**:
```bash
npm install
```

3. **Run the application**:
```bash
npm start
```

## 🎯 First Launch

### 1. Initial Setup
When you first launch Genome AI Studio, you'll see the welcome screen with options to:
- Load a genome file
- Open annotation files
- Import variant data
- Open sequencing reads

### 2. Loading Your First Genome
1. Click **"Load File"** in the toolbar or use the welcome screen
2. Select your genome file (FASTA, GenBank, etc.)
3. The application will process and display your genomic data
4. Use the navigation controls to explore your genome

### 3. Basic Navigation
- **Zoom**: Use the zoom controls or mouse wheel
- **Pan**: Drag the visualization to move around
- **Search**: Use the search bar to find specific genes or regions
- **Tracks**: Toggle different data tracks on and off

## 🤖 Setting Up AI Chat (Optional)

The AI assistant provides natural language interaction with your genomic data.

### 1. Configure AI Provider
1. Go to **Options → Configure LLMs**
2. Choose your preferred AI provider:
   - **OpenAI** (GPT-4, GPT-3.5)
   - **Anthropic** (Claude)
   - **Google** (Gemini)
   - **Local LLM** (Ollama, etc.)

### 2. Add API Credentials
1. Enter your API key for your chosen provider
2. Test the connection
3. Save the configuration

### 3. Start Chatting
- Use the chat panel to ask questions about your data
- Example queries:
  - "Show me all ribosomal genes"
  - "What genes are in this region?"
  - "Find genes involved in DNA repair"

## 📁 Working with Projects

### Creating a New Project
1. Go to **File → New Project**
2. Choose a project template or start blank
3. Set up your project directory structure
4. Add your genomic data files

### Opening Existing Projects
1. Use **File → Open Project** (Ctrl+Shift+O)
2. Select a `.prj.GAI` project file
3. The project will load with all associated data

### Project View Modes
Switch between different project views:
- **Grid View**: Visual grid of files and folders
- **List View**: Detailed list with metadata
- **Details View**: Comprehensive information table

## 🔬 Core Features Overview

### 1. Genome Visualization
- **Interactive tracks** for genes, variants, reads, and more
- **Real-time navigation** with smooth zooming and panning
- **Customizable track heights** and ordering
- **Multi-format support** for various data types

### 2. Analysis Tools
- **BLAST searches** with integrated database management
- **Sequence analysis** tools for GC content, translation, etc.
- **Protein structure visualization** with AlphaFold integration
- **Pathway analysis** with KGML viewer

### 3. Data Export
- Export sequences in multiple formats (FASTA, GenBank, etc.)
- Export visualizations as images
- Export analysis results as tables

### 4. Plugin System
- Browse and install plugins from the marketplace
- Extend functionality with community-developed tools
- Create custom plugins for specialized analyses

## 📖 Example Workflow

### Analyzing a Bacterial Genome

1. **Load Data**:
   - Load your bacterial genome (FASTA or GenBank)
   - Add annotation files (GFF/GTF) if available

2. **Explore the Genome**:
   - Navigate to different regions using the search bar
   - Examine gene annotations and features
   - Look at GC content and skew patterns

3. **Perform Analysis**:
   - Use BLAST to search for specific sequences
   - Analyze protein sequences with structure tools
   - Examine metabolic pathways with pathway viewer

4. **AI-Assisted Analysis**:
   - Ask the AI assistant about specific genes
   - Get explanations of gene functions
   - Find related genes or pathways

5. **Export Results**:
   - Export interesting sequences for further analysis
   - Save visualizations as images
   - Export annotations as GFF files

## 🎛️ Interface Overview

### Main Window Components
- **Header Toolbar**: File operations, zoom controls, search
- **Track Panel**: Genomic data visualization tracks
- **Side Panel**: Gene details, chat interface, file browser
- **Status Bar**: Current position, statistics, system status

### Keyboard Shortcuts
- **Ctrl+O**: Open file
- **Ctrl+S**: Save project
- **Ctrl+F**: Search
- **Ctrl+Plus/Minus**: Zoom in/out
- **Ctrl+Shift+O**: Open project
- **Ctrl+Shift+K**: Open KGML viewer

## 🔧 Customization

### Track Settings
- Adjust track heights by dragging resize handles
- Reorder tracks by dragging them up and down
- Toggle track visibility using the sidebar controls
- Customize colors and display options

### UI Preferences
- Adjust zoom sensitivity
- Configure search behavior
- Set default file locations
- Customize keyboard shortcuts

## 📚 Learning Resources

### Tutorials
- **[User Manual](USER_MANUAL.md)** - Comprehensive user guide
- **[Bioinformatics Tools](BIOINFORMATICS_TOOLS_README.md)** - Analysis tools overview
- **[Plugin Usage](PLUGIN_MARKETPLACE_USAGE_GUIDE.md)** - Working with plugins

### Example Data
The application includes sample data for testing:
- E. coli genome with annotations
- Example VCF files with variants
- Sample KGML pathway files
- Protein structure examples

### Video Tutorials
- Basic navigation and visualization
- Setting up AI chat integration
- Working with plugins
- Advanced analysis workflows

## 🆘 Getting Help

### Troubleshooting
- Check the **[Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)** for common issues
- Verify system requirements and dependencies
- Check the error console in developer tools

### Support Channels
- **GitHub Issues**: Report bugs or request features
- **Documentation**: Comprehensive guides and API docs
- **Community**: Join discussions and share experiences

### FAQ
- **Q**: Can I use Genome AI Studio without an internet connection?
  **A**: Yes, core features work offline. AI chat and some database features require internet.

- **Q**: What file formats are supported?
  **A**: FASTA, GenBank, GFF/GTF, BED, VCF, SAM/BAM, WIG, KGML, and project files (.prj.GAI).

- **Q**: How do I install additional tools like BLAST?
  **A**: Use the built-in BLAST installer under Tools menu.

## 🎯 Next Steps

Now that you're set up, explore these advanced features:

1. **[Install plugins](PLUGIN_MARKETPLACE_USAGE_GUIDE.md)** from the marketplace
2. **[Set up BLAST tools](../BLAST_GUIDE.md)** for sequence analysis
3. **[Configure advanced visualization](USER_MANUAL.md#advanced-visualization)** options
4. **[Learn about the API](API_DOCUMENTATION.md)** for custom development

## 📝 Feedback

We'd love to hear about your experience! Please:
- Report any issues you encounter
- Suggest new features or improvements
- Share your analysis workflows
- Contribute to the documentation

---

**Happy analyzing!** 🧬

*This guide covers Genome AI Studio v0.3.0-beta. For the latest updates, check the project repository.* 