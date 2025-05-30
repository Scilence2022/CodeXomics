# Genome Browser Modular Architecture

This document describes the modular architecture of the Electron Genome Browser application.

## Overview

The application has been refactored from a single large `renderer.js` file into a modular architecture with separate modules for different functionalities. This improves code organization, maintainability, and makes it easier to add new features.

## Module Structure

### Core Modules

#### 1. **FileManager.js**
Handles all file operations including loading, parsing, and file type management.

**Key Features:**
- File type detection and validation
- FASTA, GenBank, GFF, VCF, SAM file parsers
- File loading with progress indication
- Error handling and user feedback

**Main Methods:**
- `openFile()` - Generic file opener
- `openSpecificFileType(type)` - Type-specific file opener
- `loadFile(filePath)` - Load and parse file
- `parseFASTA()`, `parseGenBank()`, `parseGFF()`, etc. - Format-specific parsers

#### 2. **TrackRenderer.js**
Handles all track creation and visualization.

**Key Features:**
- Genome ruler creation
- Gene/feature track rendering with user-defined feature support
- Sequence track with dynamic sizing
- GC content visualization
- Variant and reads track display
- Protein track rendering
- User-defined feature styling and visual distinction

**Main Methods:**
- `createRuler()` - Position ruler
- `createGeneTrack()` - Gene annotations with user feature integration
- `createSequenceTrack()` - DNA sequence display
- `createGCTrack()` - GC content graph
- `createVariantTrack()` - SNP/variant display
- `createReadsTrack()` - Aligned reads
- `createProteinTrack()` - Protein sequences

#### 3. **NavigationManager.js**
Handles navigation, search, zoom, and position management.

**Key Features:**
- Position navigation (previous/next)
- Zoom controls (in/out/reset)
- Search functionality
- Go-to position
- Drag-based navigation
- Keyboard shortcuts

**Main Methods:**
- `navigatePrevious()`, `navigateNext()` - Position navigation
- `zoomIn()`, `zoomOut()`, `resetZoom()` - Zoom controls
- `performSearch()` - Gene/feature search
- `goToPosition()` - Jump to specific position
- `makeDraggable()` - Enable drag navigation

#### 4. **UIManager.js**
Handles all UI interactions, panels, splitters, and interface management.

**Key Features:**
- Panel show/hide management
- Sidebar toggle functionality
- Splitter controls (horizontal/vertical)
- Modal dialog management
- File dropdown menus
- Toggle button states

**Main Methods:**
- `showPanel()`, `closePanel()` - Panel management
- `toggleSidebar()` - Sidebar visibility
- `initializeSplitter()` - Splitter setup
- `toggleFileDropdown()` - File menu
- `updateToggleButtonStates()` - UI state sync

#### 5. **SequenceUtils.js**
Handles sequence processing, display, and biological utilities.

**Key Features:**
- Sequence display with multiple detail levels
- DNA to protein translation
- Sequence colorization
- Copy/export functionality
- Biological calculations (GC content, etc.)
- Chromosome management

**Main Methods:**
- `displayEnhancedSequence()` - Smart sequence display
- `translateDNA()` - Genetic code translation
- `colorizeSequence()` - Base pair coloring
- `copySequence()`, `exportSequence()` - Sequence operations
- `updateStatistics()` - Sequence analysis

### Main Application

#### **renderer-modular.js**
The main application class that coordinates all modules.

**Key Features:**
- Module initialization and coordination
- Event listener setup
- IPC communication with main process
- Track visibility management
- Gene filter controls
- User-defined feature creation and management
- Sequence selection for precise annotation
- Feature creation modal and validation

## Usage

### Using the Current Monolithic Version
The current `renderer.js` file contains all functionality in a single file. This works but is harder to maintain.

### Switching to Modular Version

To switch to the modular architecture:

1. **Update HTML to load modules:**
   ```html
   <!-- Load modules -->
   <script src="modules/FileManager.js"></script>
   <script src="modules/TrackRenderer.js"></script>
   <script src="modules/NavigationManager.js"></script>
   <script src="modules/UIManager.js"></script>
   <script src="modules/SequenceUtils.js"></script>
   
   <!-- Main application -->
   <script src="renderer-modular.js"></script>
   ```

2. **Replace renderer.js:**
   ```bash
   mv renderer.js renderer-old.js
   mv renderer-modular.js renderer.js
   ```

## Benefits of Modular Architecture

### 1. **Improved Maintainability**
- Each module has a single responsibility
- Easier to locate and fix bugs
- Cleaner code organization

### 2. **Better Scalability**
- Easy to add new features to specific modules
- Modules can be developed independently
- Reduced risk of breaking existing functionality

### 3. **Enhanced Testability**
- Individual modules can be unit tested
- Easier to mock dependencies
- Better test coverage

### 4. **Code Reusability**
- Modules can be reused in other projects
- Common functionality is centralized
- Easier to extract libraries

### 5. **Team Development**
- Multiple developers can work on different modules
- Reduced merge conflicts
- Clear ownership of functionality

## Module Dependencies

```
GenomeBrowser (main)
├── FileManager
├── TrackRenderer
├── NavigationManager
├── UIManager
└── SequenceUtils
```

Each module receives a reference to the main GenomeBrowser instance, allowing access to shared data and other modules when needed.

## Adding New Features

### To add a new file format:
1. Add parser method to `FileManager.js`
2. Update file type detection logic
3. Add UI elements if needed

### To add a new track type:
1. Add creation method to `TrackRenderer.js`
2. Update track visibility controls
3. Add to main display logic

### To add new navigation features:
1. Add methods to `NavigationManager.js`
2. Update event listeners in main class
3. Add keyboard shortcuts if needed

### To add new UI components:
1. Add methods to `UIManager.js`
2. Update HTML/CSS as needed
3. Add event listeners in main class

### To add new user feature types:
1. Update feature type options in HTML modal
2. Add styling to `TrackRenderer.js` for new types
3. Update validation logic in main application
4. Add visual styling in CSS for new feature types

## Recent Enhancements

### User-Defined Features System
The application now supports creating custom genomic annotations through an interactive interface:

**Key Components:**
- **Toolbar Integration**: Quick access buttons for common feature types
- **Sequence Selection**: Click-and-drag selection in sequence panel for precise coordinates  
- **Modal Interface**: Comprehensive form for feature creation with validation
- **Visual Integration**: User features display with special styling (dashed borders, green highlighting)
- **Feature Types**: Support for genes, CDS, regulatory elements, promoters, terminators, and comments

**Implementation Details:**
- Features stored in memory during session (`userDefinedFeatures` object)
- Integrated with existing annotation system for seamless display
- Special rendering logic in `TrackRenderer.js` for visual distinction
- Real-time validation and error handling
- Event management for sequence selection and modal interactions

## File Structure

```
src/renderer/
├── index.html              # Main HTML file
├── styles.css              # Styles
├── renderer.js             # Current monolithic version
├── renderer-modular.js     # New modular version
└── modules/
    ├── README.md           # This file
    ├── FileManager.js      # File operations
    ├── TrackRenderer.js    # Track visualization
    ├── NavigationManager.js # Navigation & search
    ├── UIManager.js        # UI interactions
    └── SequenceUtils.js    # Sequence processing
```

## Migration Strategy

1. **Phase 1:** Create modular version alongside existing code
2. **Phase 2:** Test modular version thoroughly
3. **Phase 3:** Switch to modular version
4. **Phase 4:** Remove old monolithic code
5. **Phase 5:** Add new features using modular approach

This approach ensures no functionality is lost during the transition and allows for thorough testing of the new architecture. 