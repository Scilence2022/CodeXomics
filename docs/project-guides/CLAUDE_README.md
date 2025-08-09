# CLAUDE README

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Genome AI Studio** is a cross-platform Electron-based genome analysis studio with AI-powered natural language interaction. It provides advanced genome visualization, bioinformatics tools, and a modular plugin architecture for genomic research.

## Development Commands

### Primary Development
```bash
# Start development server
npm start

# Start with development mode
npm run dev

# Start with MCP server (for AI features)
npm run start-with-mcp

# Run MCP server separately
npm run mcp-server
```

### Build Commands
```bash
# Build for current platform
npm run build

# Platform-specific builds
npm run build:mac
npm run build:win
npm run build:linux
npm run build:all

# Create distribution packages
npm run dist
```

### Testing
```bash
# No automated tests currently configured
# Manual testing through HTML test files in test/ directory
# Integration tests in test/integration-tests/
# Unit tests in test/unit-tests/
```

## High-Level Architecture

### Core Structure
- **Main Process**: `src/main.js` - Electron main process with window management
- **Renderer Process**: `src/renderer/renderer-modular.js` - Main application controller
- **Modular Architecture**: `src/renderer/modules/` - Feature-specific modules

### Key Modules

#### Core Modules
- **FileManager.js**: File operations, parsing (FASTA, GenBank, GFF, VCF, SAM/BAM)
- **TrackRenderer.js**: Visualization engine with SVG-based graphics
- **NavigationManager.js**: Search, navigation, zoom controls
- **UIManager.js**: Interface management, panels, splitters
- **SequenceUtils.js**: Sequence processing and biological utilities

#### AI Integration
- **ChatManager.js**: AI assistant with LLM integration
- **LLMConfigManager.js**: Multi-provider LLM configuration (OpenAI, Anthropic, Google, Local)
- **ConfigManager.js**: Centralized configuration management

#### Plugin System
- **PluginManagerV2.js**: Plugin lifecycle management
- **PluginMarketplace.js**: Plugin marketplace integration
- **PluginAPI.js**: Plugin interface and security
- **Plugins/**: Built-in biological network plugins

### File Format Support
- **FASTA**: Genome sequences (import/export)
- **GenBank**: Complete genomic records (import/export)
- **GFF/GTF**: Gene annotations (import/export)
- **BED**: Genomic regions (import/export)
- **VCF**: Variants (import only)
- **SAM/BAM**: Read alignments (import only)
- **WIG**: Track data (import/export)

### AI Function Calling Rules
**CRITICAL**: Follow these function selection rules for AI integration:
- For text-based searches: ALWAYS use `search_features`
- For position-based searches: ONLY use `get_nearby_features`
- Never mix these functions - they serve different purposes

## Development Guidelines

### Module Development
- Follow the established modular pattern in `src/renderer/modules/`
- Use dependency injection for module communication
- Implement proper initialization with async/await
- Maintain clear API boundaries between modules

### Code Standards
- Use ES6+ syntax and features
- Implement proper error handling with try-catch blocks
- Use consistent naming conventions:
  - Classes: `PascalCase`
  - Methods/Variables: `camelCase`
  - Constants: `SCREAMING_SNAKE_CASE`
  - Files: `PascalCase.js`

### Plugin Development
```javascript
const plugin = {
    name: 'PluginName',
    version: '1.0.0',
    description: 'Plugin description',
    author: 'Author name',
    functions: {
        functionName: {
            description: 'Function description',
            parameters: {/* JSON schema */},
            execute: async (params) => {/* implementation */}
        }
    }
};
```

## Configuration

### Application Configuration
Configuration files are stored in `~/.genome-ai-studio/`:
- `config.json` - Main application settings
- `llm-config.json` - AI provider configurations
- `ui-preferences.json` - Interface customizations
- `chat-history.json` - Conversation history

### Build Configuration
Build settings are in `package.json` under the `build` section, configured for:
- macOS: DMG and ZIP distributions
- Windows: NSIS installer and portable
- Linux: AppImage, DEB, RPM, and Snap packages

## Important Files

### Main Application Files
- `src/main.js` - Electron main process
- `src/preload.js` - Preload script for renderer security
- `src/renderer/index.html` - Main UI structure
- `src/renderer/renderer-modular.js` - Application controller

### Documentation
- `README.md` - User documentation and setup instructions
- `PROJECT_RULES.md` - Development rules and standards
- `docs/project-guides/build-instructions.md` - Comprehensive build guide
- `docs/implementation-summaries/` - Feature implementation summaries

### Testing
- `test/` - Test files (HTML-based manual tests)
- `test/integration-tests/` - Integration test suites
- `test/unit-tests/` - Unit test files

## Common Tasks

### Adding New File Format Support
1. Add parser method to `FileManager.js`
2. Update file type detection logic
3. Add UI elements if needed
4. Update documentation

### Adding New Track Type
1. Add creation method to `TrackRenderer.js`
2. Use `createTrackBase()` for consistent structure
3. Update track visibility controls
4. Add to main display logic

### Adding New AI Tools
1. Add method to `ChatManager.js`
2. Update system prompts in `LLMConfigManager.js`
3. Follow function calling rules (text search = `search_features`)
4. Test function calling behavior

### Enhancing Search Capabilities
1. Update search methods in `NavigationManager.js`
2. Enhance results display functionality
3. Add new search options if needed
4. Update AI integration for new search types

## Performance Considerations

### Memory Management
- Use SVG for graphics when possible
- Implement proper cleanup in module destructors
- Use efficient data structures for large datasets
- Monitor memory usage during development

### Rendering Optimization
- Lazy load components when possible
- Use requestAnimationFrame for smooth animations
- Implement virtual scrolling for large lists
- Optimize DOM manipulations

## Security Notes

- Plugin system runs in sandboxed environment
- Validate all user inputs before processing
- Sanitize file content before processing
- Protect API keys and sensitive configuration
- Implement rate limiting for AI integration

## Getting Started

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm start` to start the development server
4. For AI features, configure LLM providers in Settings
5. Load sample data files from `test_data/` directory