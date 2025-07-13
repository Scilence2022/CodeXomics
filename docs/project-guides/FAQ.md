# Frequently Asked Questions (FAQ)

## 📋 General Questions

### What is Genome AI Studio?

Genome AI Studio is an advanced, AI-powered genome analysis platform that provides comprehensive tools for genomic visualization, analysis, and interpretation. It features an integrated plugin system, natural language AI assistant, and support for multiple genomic data formats.

### What's new in v0.3 beta?

Version 0.3 beta introduces several major enhancements:
- **Complete Plugin System** with marketplace
- **KGML Pathway Viewer** for pathway visualization
- **Enhanced Gene Details** with 50+ database cross-references
- **STRING Protein Networks** for interaction analysis
- **Unified Version Management** system
- **Improved Project Management** with multiple view modes
- **Conversation Evolution** system for AI interactions

### What operating systems are supported?

Genome AI Studio supports:
- **macOS** 10.14 and later
- **Windows** 10 and later
- **Linux** (Ubuntu 18.04+ and other modern distributions)

### Is Genome AI Studio free?

The core application is free and open-source. Some advanced features may require:
- API keys for AI services (OpenAI, Anthropic, Google)
- Premium plugins from the marketplace
- External database subscriptions

## 🚀 Installation & Setup

### How do I install Genome AI Studio?

1. **Download** the latest release for your platform from GitHub
2. **Install** following platform-specific instructions:
   - **macOS**: Open DMG and drag to Applications
   - **Windows**: Run the installer executable
   - **Linux**: Make AppImage executable and run
3. **Launch** the application

### Can I use it without an internet connection?

Yes, core functionality works offline including:
- Genome visualization
- File operations
- Basic analysis tools
- Local file management

Internet connection is required for:
- AI assistant features
- Plugin marketplace
- External database access
- BLAST database downloads

### How do I set up the AI assistant?

1. Go to **Options → Configure LLMs**
2. Choose your AI provider (OpenAI, Anthropic, Google, or Local)
3. Enter your API key
4. Test the connection
5. Save configuration

For local AI models, install Ollama and configure the local endpoint.

### What if I don't have an API key for AI services?

You can:
- Use the application without AI features
- Set up a local LLM using Ollama (free)
- Get free API keys from OpenAI, Anthropic, or Google (with usage limits)
- Use the application's other analysis tools

## 📁 File Formats & Data

### What file formats are supported?

| Format | Type | Import | Export |
|--------|------|---------|---------|
| FASTA | Sequences | ✅ | ✅ |
| GenBank | Genomes | ✅ | ✅ |
| GFF/GTF | Annotations | ✅ | ✅ |
| BED | Regions | ✅ | ✅ |
| VCF | Variants | ✅ | ❌ |
| SAM/BAM | Reads | ✅ | ❌ |
| WIG | Tracks | ✅ | ✅ |
| KGML | Pathways | ✅ | ✅ |
| PRJ.GAI | Projects | ✅ | ✅ |

### How large files can I work with?

- **Recommended**: Files under 100MB for optimal performance
- **Supported**: Files up to 500MB with streaming mode
- **Large files**: Use indexed formats (BAM) or split into smaller chunks
- **Memory**: 6GB RAM minimum, 12GB recommended for large datasets

### Can I work with multiple genomes?

Yes, you can:
- Load multiple genome files in the same project
- Compare genomes using comparative analysis tools
- Use the tab system for multi-genome analysis
- Create multi-genome projects with templates

### How do I handle corrupted or invalid files?

1. **Check file integrity**: Verify file is not corrupted
2. **Validate format**: Ensure file follows format specifications
3. **Convert format**: Use external tools to convert if needed
4. **Contact support**: Report persistent format issues

## 🔬 Analysis & Tools

### How do I perform BLAST searches?

1. **Install BLAST+**: Tools → Install BLAST+
2. **Select sequence**: Choose region or gene to search
3. **Configure search**: Choose database and parameters
4. **Run search**: Wait for results
5. **Analyze results**: View alignments and export data

### What databases are available for BLAST?

Built-in support for:
- NCBI nucleotide (nt)
- NCBI protein (nr)
- RefSeq genomes
- Custom databases

You can also create custom databases from your own sequences.

### How do I use the pathway viewer?

1. **Open KGML Viewer**: Tools → Visualization Tools → KGML Pathway Viewer (Ctrl+Shift+K)
2. **Load pathway**: Select KGML file or download from KEGG
3. **Explore**: Zoom, pan, and click nodes for information
4. **Analyze**: Map your genes to pathway components
5. **Export**: Save pathway images or data

### Can I create custom annotations?

Yes:
1. **Select region**: Click and drag in the track area
2. **Choose feature type**: Gene, CDS, regulatory element, etc.
3. **Add information**: Name, description, strand
4. **Save**: Feature appears in visualization
5. **Export**: Save annotations as GFF/BED files

## 🔌 Plugin System

### How do I install plugins?

1. **Open Marketplace**: Plugins → Plugin Marketplace
2. **Browse plugins**: Filter by category or search
3. **Select plugin**: Click for details and reviews
4. **Install**: Click install button
5. **Activate**: Plugin becomes available in menus

### Are plugins safe?

Plugins undergo validation including:
- **Security scanning** for malicious code
- **Functionality testing** for stability
- **Code review** for quality
- **User feedback** and ratings

### Can I develop my own plugins?

Yes! See the **[Plugin Development Guide](PLUGIN_DEVELOPMENT_GUIDE.md)** for:
- Development environment setup
- Plugin API documentation
- Examples and templates
- Publishing guidelines

### How do I uninstall plugins?

1. **Plugin Manager**: Plugins → Manage Plugins
2. **Select plugin**: Find the plugin to remove
3. **Uninstall**: Click uninstall button
4. **Confirm**: Confirm removal
5. **Restart**: Restart application if required

## 🤖 AI Assistant

### What can the AI assistant do?

The AI can help with:
- **Gene information**: "What does lacZ do?"
- **Navigation**: "Go to the lac operon"
- **Analysis**: "Calculate GC content"
- **Export**: "Export current region as FASTA"
- **Tool activation**: "Run BLAST search"
- **Workflow guidance**: Step-by-step analysis help

### Why isn't the AI responding?

Check:
1. **API key**: Verify credentials are correct
2. **Internet connection**: Ensure stable connectivity
3. **API status**: Check provider service status
4. **Rate limits**: Wait if you've exceeded limits
5. **Configuration**: Re-test connection in settings

### Can I use local AI models?

Yes, with Ollama:
1. **Install Ollama**: Download from ollama.ai
2. **Install model**: `ollama pull llama3`
3. **Configure**: Set provider to "local" in LLM settings
4. **Set endpoint**: http://localhost:11434/v1
5. **Test**: Verify connection works

### Is my data sent to AI providers?

- **Query context**: Only relevant data is sent with queries
- **No bulk transfer**: Complete genomes are not uploaded
- **Privacy options**: Configure what data to share
- **Local option**: Use local models for complete privacy

## 🗂️ Project Management

### How do projects work?

Projects organize related files and analyses:
- **Project file**: `.prj.GAI` contains project metadata
- **Data folder**: Stores imported files
- **Results folder**: Contains analysis outputs
- **Auto-save**: Projects save changes automatically

### Can I share projects with others?

Yes:
- **Export project**: File → Export Project
- **Include data**: Option to bundle all data files
- **Share package**: Send .zip file to collaborators
- **Cloud storage**: Use cloud services for sharing

### How do I backup projects?

- **Manual backup**: File → Export Project
- **Auto-backup**: Enable in settings for automatic backups
- **Version control**: Projects maintain change history
- **Cloud sync**: Use cloud storage for backup

### Can I work on multiple projects?

Yes:
- **Multiple windows**: Open multiple project windows
- **Tab system**: Switch between different datasets
- **Project switcher**: Quickly change active project
- **Resource management**: Efficient memory usage

## 🖥️ Interface & Navigation

### How do I navigate large genomes?

- **Search**: Use search bar to find genes/regions
- **Coordinate input**: Enter specific positions
- **Bookmarks**: Save interesting locations
- **Zoom controls**: Use + and - buttons or mouse wheel
- **Mini-map**: Navigate using overview track

### Can I customize the interface?

Yes:
- **Track heights**: Drag to resize tracks
- **Track order**: Drag to reorder tracks
- **Color schemes**: Customize track colors
- **Panel layout**: Adjust side panel size
- **View modes**: Switch between Grid/List/Details

### What keyboard shortcuts are available?

Common shortcuts:
- **Ctrl+O**: Open file
- **Ctrl+S**: Save project
- **Ctrl+F**: Search
- **Ctrl+Shift+O**: Open project
- **Ctrl+Shift+K**: KGML viewer
- **F12**: Developer console (for debugging)

### How do I view gene details?

- **Click gene**: Gene information appears in side panel
- **Gene details panel**: Shows comprehensive information
- **Database links**: Cross-references to 50+ databases
- **Sequence information**: Shows gene sequences
- **Export options**: Export gene data

## ⚙️ Performance & Troubleshooting

### The application is running slowly. How can I fix it?

1. **Check memory**: Monitor system memory usage
2. **Close tracks**: Hide unused tracks to free memory
3. **Simple mode**: Enable simple mode for better performance
4. **Restart**: Restart application to clear memory
5. **Update**: Ensure you have the latest version

### Files won't load. What should I check?

1. **File format**: Verify format is supported
2. **File integrity**: Check file isn't corrupted
3. **File size**: Large files may need streaming mode
4. **Permissions**: Ensure file is readable
5. **Path length**: Avoid very long file paths

### The AI assistant gives errors. How to fix?

1. **Check API key**: Verify key is valid and active
2. **Internet**: Ensure stable internet connection
3. **Rate limits**: Wait if you've hit usage limits
4. **Try different provider**: Switch AI providers
5. **Update**: Check for application updates

### How do I report bugs?

1. **Gather information**: Error messages, system specs, steps to reproduce
2. **GitHub Issues**: Report at project repository
3. **Include logs**: Check application logs in user data directory
4. **Screenshots**: Include relevant screenshots
5. **Expected behavior**: Describe what should happen

## 🔧 Advanced Features

### Can I automate analyses?

Yes, through:
- **AI workflows**: Use AI to chain operations
- **Plugin scripts**: Create automated analysis plugins
- **Batch processing**: Process multiple files
- **Custom tools**: Develop specialized automation

### How do I export high-quality figures?

1. **Vector format**: Export as SVG for scalability
2. **High resolution**: Use PNG with high DPI settings
3. **Print layout**: Optimize for publication
4. **Multi-panel**: Combine multiple views
5. **Annotations**: Add labels and captions

### Can I integrate with other tools?

Yes:
- **Export formats**: Use standard formats for interoperability
- **API access**: Plugin system provides programmatic access
- **Command line**: Some operations support batch processing
- **Web services**: Connect to external databases and tools

### How do I contribute to the project?

- **Bug reports**: Report issues on GitHub
- **Feature requests**: Suggest improvements
- **Plugin development**: Create and share plugins
- **Documentation**: Help improve guides and docs
- **Code contributions**: Submit pull requests

## 📞 Support & Community

### Where can I get help?

- **Documentation**: Comprehensive guides and manuals
- **FAQ**: This document for common questions
- **GitHub Issues**: Report bugs and ask questions
- **Community Forum**: Connect with other users
- **Email Support**: For complex issues

### Is there a user community?

Yes:
- **GitHub Discussions**: Community Q&A
- **Discord Server**: Real-time chat with users
- **Monthly Meetups**: Virtual user meetings
- **Plugin Developers**: Special developer community

### How do I stay updated?

- **GitHub Releases**: Watch repository for updates
- **Newsletter**: Subscribe for major announcements
- **Social Media**: Follow project accounts
- **In-app notifications**: Enable update notifications

### Can I request new features?

Absolutely:
- **GitHub Issues**: Submit feature requests
- **Community Voting**: Popular requests get priority
- **Plugin Development**: Create custom functionality
- **Sponsorship**: Support development of specific features

---

**Still have questions?** 

- Check the **[User Manual](USER_MANUAL.md)** for detailed instructions
- Visit our **[Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)** for technical issues
- Browse the **[Documentation](../README.md)** for comprehensive information
- Contact **support** for personalized assistance

*This FAQ covers Genome AI Studio v0.3.0-beta. For the latest information, check the project repository.* 