# Resource Manager - GenomeExplorer

## Overview

The Resource Manager is a separate window that provides comprehensive management of all loaded data files and resources in GenomeExplorer. It offers a centralized view of all genomic data, annotations, variants, and other biological data files that are currently loaded in the main application.

## Access

Open the Resource Manager from the main application menu:
- **View → Resource Manager** (Keyboard shortcut: Ctrl/Cmd+R)

## Features

### 1. Organized Resource Categories

The Resource Manager organizes loaded files into logical categories:

#### Sequence Data
- **FASTA Files** - Reference genome sequences and other sequence data

#### Annotation Data  
- **GFF/GTF Files** - Gene annotations, feature definitions, and structural annotations

#### Variant Data
- **VCF Files** - Variant call format files containing genetic variations

#### Sequencing Reads
- **BAM/SAM Files** - Aligned sequence reads
- **FASTQ Files** - Raw sequencing reads

#### Track Data
- **WIG/BigWig Files** - Track data for visualization (coverage, signals, etc.)

#### Other Resources
- **All Resources** - Combined view of all loaded data

### 2. Resource Information

For each loaded resource, the Resource Manager displays:

- **File Details**
  - File name and path
  - File size and load timestamp
  - Current status (loaded, loading, error)
  
- **Content Metadata**
  - Number of sequences (for FASTA files)
  - Number of features/genes (for annotation files)
  - Number of variants (for VCF files)
  - Source and version information

### 3. Resource Operations

#### View in Browser
- Opens the selected resource in the main GenomeExplorer window
- Automatically navigates to and displays the data

#### Export
- Provides options to export resource data in various formats
- Maintains data integrity and metadata

#### Remove
- Safely removes resources from the current session
- Confirms before deletion to prevent accidental data loss

#### Refresh
- Updates the resource list with current status from main window
- Synchronizes with any changes made in the main application

### 4. Search and Filter

- **Search Box** - Find resources by name or file path
- **Category Filters** - View resources by type
- **Real-time Updates** - Automatically reflects changes from main window

## Architecture

### Window Management
- Independent Electron window with secure IPC communication
- Context isolation enabled for enhanced security
- Preload script provides safe API access

### Communication
- Bidirectional communication with main GenomeExplorer window
- Real-time updates when resources are added/removed
- Secure message passing through Electron IPC

### Data Management
- Maintains synchronized view of main window resources
- Handles resource metadata and status tracking
- Provides fallback for disconnected operation

## Technical Implementation

### Main Process (main.js)
- Window creation and management
- IPC handlers for resource operations
- File dialog integration
- Cross-window communication

### Preload Script (preload.js)
- Secure API exposure using contextBridge
- IPC communication wrapper
- Event listener management

### Resource Manager Window (resource-manager.html)
- Modern responsive UI
- Real-time resource display
- Interactive resource management
- Error handling and user feedback

## Usage Examples

### Opening the Resource Manager
1. Launch GenomeExplorer
2. Go to **View → Resource Manager** or press **Ctrl/Cmd+R**
3. A new window opens showing all loaded resources

### Loading New Files
1. In Resource Manager, click **Load File** button
2. Select genome files using the file dialog
3. Files are automatically loaded in main window
4. Resource Manager updates to show new files

### Managing Existing Resources
1. Browse resources by category in the sidebar
2. Click on any resource to view detailed information
3. Use **View**, **Export**, or **Remove** buttons for operations
4. Changes are synchronized with main window

### Searching Resources
1. Use the search box to find specific files
2. Search works on file names and paths
3. Results update in real-time as you type

## Benefits

1. **Centralized Management** - All resources in one organized view
2. **Enhanced Productivity** - Quick access to file operations
3. **Better Organization** - Logical categorization by file type
4. **Status Monitoring** - Real-time status of all loaded data
5. **Safe Operations** - Confirmation dialogs prevent data loss
6. **Search Capability** - Fast resource discovery
7. **Metadata Display** - Comprehensive file information

## Future Enhancements

- Resource usage statistics and memory monitoring
- Batch operations for multiple files
- Resource dependency tracking
- Advanced filtering and sorting options
- Integration with external data sources
- Resource sharing and collaboration features

The Resource Manager significantly enhances GenomeExplorer's usability by providing a professional, organized approach to managing genomic data files and resources. 