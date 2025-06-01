# Genome Browser Modular Architecture

This document describes the enhanced modular architecture of the Electron Genome Browser application, including recent improvements and integrations.

## Overview

The application has evolved from a single large `renderer.js` file into a sophisticated modular architecture with separate modules for different functionalities. Recent enhancements include improved AI integration, enhanced configuration management, and optimized function calling structures.

## 🆕 Recent Enhancements

### **AI Integration Improvements**
- **Fixed search function calling** - AI now correctly uses `search_features` for text-based searches
- **Enhanced ChatManager** - Improved natural language processing and tool selection
- **Better system prompts** - More accurate AI responses with clear function distinctions

### **Configuration Management**
- **Centralized ConfigManager** - Unified configuration across all modules
- **Persistent storage** - Proper file-based configuration management
- **Error handling** - Graceful degradation and user feedback

### **Visualization Enhancements**
- **SVG-based GC content** - Crisp, scalable graphics with dynamic calculations
- **Enhanced TrackRenderer** - Improved function calling structure and performance
- **Better user feedback** - Standardized error messages and loading states

## Module Structure

### Core Modules

#### 1. **FileManager.js** - File Operations & Parsing
Handles all file operations including loading, parsing, and file type management.

**Key Features:**
- **Multi-format support** - FASTA, GenBank, GFF, VCF, SAM file parsers
- **File type detection** - Automatic format recognition and validation
- **Progress indication** - User feedback during file loading
- **Error handling** - Comprehensive error management and user feedback
- **Memory optimization** - Efficient handling of large genomic files

**Main Methods:**
- `openFile()` - Generic file opener with format detection
- `openSpecificFileType(type)` - Type-specific file operations
- `loadFile(filePath)` - Comprehensive file loading and parsing
- `parseFASTA()`, `parseGenBank()`, `parseGFF()` - Format-specific parsers
- `validateFileFormat()` - File integrity checking

#### 2. **TrackRenderer.js** - Visualization Engine
Handles all track creation and visualization with recent performance improvements.

**Enhanced Features:**
- **SVG-based GC visualization** - Crisp, scalable graphics with adaptive sizing
- **Improved function structure** - Centralized configuration and standardized patterns
- **User-defined feature support** - Custom annotation creation and styling
- **Performance optimization** - Efficient rendering and memory management
- **Enhanced error handling** - Graceful degradation and user feedback

**Main Methods:**
- `createTrackBase()` - 🆕 Unified track creation pattern
- `createRuler()` - Position ruler with zoom-adaptive scaling
- `createGeneTrack()` - Gene annotations with user feature integration
- `createSequenceTrack()` - DNA sequence display with dynamic sizing
- `createGCTrack()` - 🆕 Enhanced SVG-based GC content visualization
- `createVariantTrack()` - SNP/variant display with quality information
- `createReadsTrack()` - Aligned reads with multi-row layout
- `createProteinTrack()` - Protein sequence visualization

#### 3. **NavigationManager.js** - Navigation & Search
Handles navigation, search, zoom, and position management with enhanced search capabilities.

**Enhanced Features:**
- **Improved search results** - Automatic results panel with one-click navigation
- **AI search integration** - Seamless interaction with chat-based searches
- **Visual feedback** - Enhanced user interface with loading states
- **Performance optimization** - Faster search algorithms and indexing

**Main Methods:**
- `navigatePrevious()`, `navigateNext()` - Position navigation with context
- `zoomIn()`, `zoomOut()`, `resetZoom()` - Zoom controls with smooth transitions
- `performSearch()` - 🆕 Enhanced gene/feature search with results panel
- `populateSearchResults()` - 🆕 Automatic search results display
- `goToPosition()` - Jump to specific genomic positions
- `makeDraggable()` - Enable drag-based navigation

#### 4. **UIManager.js** - Interface Management
Handles all UI interactions, panels, splitters, and interface management.

**Enhanced Features:**
- **Improved panel management** - Better state synchronization
- **Enhanced splitter controls** - Smooth resizing with keyboard support
- **Modal dialog improvements** - Better accessibility and user experience
- **Responsive design** - Better mobile and tablet support

**Main Methods:**
- `showPanel()`, `closePanel()` - Enhanced panel management with state persistence
- `toggleSidebar()` - Sidebar visibility with animation
- `initializeSplitter()` - Splitter setup with accessibility features
- `toggleFileDropdown()` - File menu with improved organization
- `updateToggleButtonStates()` - UI state synchronization

#### 5. **SequenceUtils.js** - Sequence Processing
Handles sequence processing, display, and biological utilities.

**Enhanced Features:**
- **Improved sequence display** - Better performance with large sequences
- **Enhanced translation** - More accurate genetic code translation
- **Better colorization** - Improved color schemes and accessibility
- **Export enhancements** - Additional format support

**Main Methods:**
- `displayEnhancedSequence()` - Smart sequence display with optimization
- `translateDNA()` - Genetic code translation with error handling
- `colorizeSequence()` - Base pair coloring with accessibility
- `copySequence()`, `exportSequence()` - Enhanced sequence operations
- `updateStatistics()` - Real-time sequence analysis

### AI Integration Modules

#### 6. **ChatManager.js** - AI Assistant
Handles AI conversation, tool calling, and natural language interaction.

**🆕 Recent Fixes:**
- **Corrected search function calling** - Now properly uses `search_features` for text searches
- **Enhanced system prompts** - Better function selection guidance
- **Improved tool integration** - More reliable genome browser tool access
- **Better error handling** - Graceful degradation and user feedback

**Main Methods:**
- `searchFeatures()` - 🔧 **FIXED** Text-based gene/annotation search
- `getNearbyFeatures()` - Position-based proximity search  
- `sendToLLM()` - Enhanced AI communication with better prompts
- `executeToolByName()` - Improved tool execution with error handling
- `parseToolCall()` - Better parsing of AI responses

#### 7. **LLMConfigManager.js** - LLM Configuration
Manages LLM provider configurations and API communication.

**Enhanced Features:**
- **Multi-provider support** - OpenAI, Anthropic, Google, Local LLMs
- **Improved configuration UI** - Better user experience and validation
- **Enhanced connection testing** - More reliable connectivity verification
- **Better error handling** - Clear error messages and troubleshooting

**Main Methods:**
- `buildSystemMessage()` - 🆕 Enhanced system prompts with clear function rules
- `sendMessage()` - Improved LLM communication with better error handling
- `testConnection()` - Enhanced connection verification
- `saveConfiguration()` - Persistent configuration management

#### 8. **ConfigManager.js** - Configuration Management
Centralized configuration management across all modules.

**New Features:**
- **Unified configuration** - Single source of truth for all settings
- **File-based persistence** - Proper configuration file management
- **Async initialization** - Proper module loading order
- **Error recovery** - Graceful handling of configuration issues

### Main Application

#### **renderer-modular.js** - Application Controller
The main application class that coordinates all modules with enhanced functionality.

**Enhanced Features:**
- **Improved module coordination** - Better initialization and communication
- **Enhanced error handling** - Comprehensive error management
- **Better user feedback** - Loading states and progress indicators
- **Performance optimization** - Efficient resource management

**Key Responsibilities:**
- Module initialization with proper dependency management
- Event listener setup and coordination
- IPC communication with main process
- Track visibility and configuration management
- User-defined feature creation and management
- Sequence selection for precise annotation
- Feature creation modal and validation

## Benefits of Enhanced Modular Architecture

### 1. **Improved Reliability**
- **Fixed AI function calling** - Eliminates search confusion
- **Better error handling** - Graceful degradation across modules
- **Enhanced testing** - Individual module validation
- **Reduced dependencies** - Clearer module boundaries

### 2. **Enhanced Performance**
- **Optimized rendering** - SVG-based graphics and efficient algorithms
- **Memory management** - Better resource cleanup and optimization
- **Faster search** - Improved indexing and result display
- **Responsive UI** - Smooth animations and interactions

### 3. **Better Maintainability**
- **Single responsibility** - Each module has clear purpose
- **Easier debugging** - Isolated functionality for faster issue resolution
- **Cleaner code organization** - Standardized patterns and practices
- **Better documentation** - Clear API boundaries and usage examples

### 4. **Improved Scalability**
- **Easy feature addition** - Clear module extension patterns
- **Independent development** - Modules can be developed separately
- **Reduced risk** - Changes isolated to specific functionality areas
- **Plugin architecture** - Foundation for third-party extensions

### 5. **Enhanced User Experience**
- **More reliable AI** - Correct function calling and better responses
- **Better visualization** - Crisp SVG graphics and smooth interactions
- **Improved search** - Automatic results panel and one-click navigation
- **Enhanced feedback** - Better error messages and loading states

## Module Dependencies

```
GenomeBrowser (main)
├── ConfigManager (centralized configuration)
├── FileManager (file operations)
├── TrackRenderer (visualization)
├── NavigationManager (search & navigation)
├── UIManager (interface management)
├── SequenceUtils (sequence processing)
├── ChatManager (AI assistant)
└── LLMConfigManager (AI configuration)
```

Each module receives references to shared components (like ConfigManager) and can communicate through well-defined APIs.

## Usage Guidelines

### **Current Recommended Version**
Use the modular architecture (`renderer-modular.js`) for all new development:

1. **Better AI integration** - Fixed search function calling
2. **Enhanced visualization** - SVG-based GC content
3. **Improved performance** - Optimized rendering and memory usage
4. **Better reliability** - Comprehensive error handling

### **Module Communication**
- **Shared state** - ConfigManager provides centralized configuration
- **Event-driven updates** - Real-time synchronization between modules
- **Clear APIs** - Well-defined interfaces between components
- **Error propagation** - Graceful error handling across module boundaries

## Adding New Features

### **To add a new file format:**
1. Add parser method to `FileManager.js`
2. Update file type detection logic
3. Add UI elements if needed
4. Update documentation

### **To add a new track type:**
1. Add creation method to `TrackRenderer.js`
2. Use `createTrackBase()` for consistent structure
3. Update track visibility controls
4. Add to main display logic

### **To add new AI tools:**
1. Add method to `ChatManager.js`
2. Update system prompts in `LLMConfigManager.js`
3. Add clear examples and usage guidelines
4. Test function calling behavior

### **To enhance search capabilities:**
1. Update search methods in `NavigationManager.js`
2. Enhance results display functionality
3. Add new search options if needed
4. Update AI integration for new search types

## Performance Considerations

### **Memory Management**
- Use SVG for graphics when possible (vs canvas)
- Implement proper cleanup in module destructors
- Use efficient data structures for large datasets
- Monitor memory usage during development

### **Rendering Optimization**
- Lazy load components when possible
- Use requestAnimationFrame for smooth animations
- Implement virtual scrolling for large lists
- Optimize DOM manipulations

### **Search Performance**
- Build search indices for frequently searched data
- Use efficient string matching algorithms
- Implement result caching where appropriate
- Provide progressive result loading for large datasets

This enhanced modular architecture provides a solid foundation for continued development of the Electron Genome Browser, with particular emphasis on AI reliability, visual quality, and overall user experience. 