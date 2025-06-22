# BAM File Support Implementation

## Overview

This document describes the implementation of BAM file support in GenomeExplorer. BAM (Binary Alignment Map) files are the compressed binary version of SAM files, commonly used for storing aligned DNA sequencing reads.

## Implementation Architecture

### Core Components

1. **BamReader** (`src/renderer/modules/BamReader.js`) - Frontend BAM file interface
2. **Main Process Handlers** (`src/main.js`) - Backend BAM processing using IPC
3. **FileManager Integration** (`src/renderer/modules/FileManager.js`) - File type detection and routing
4. **ReadsManager Integration** (`src/renderer/modules/ReadsManager.js`) - Data processing and visualization

### Technical Architecture

```
Renderer Process              Main Process
┌─────────────────┐          ┌─────────────────┐
│   BamReader     │  IPC     │   BAM Handler   │
│   (Frontend)    │ ────────▶│   (@gmod/bam)   │
└─────────────────┘          └─────────────────┘
```

### Dependencies

- **@gmod/bam**: Core BAM parsing library (v6.0.4+)
- **Electron IPC**: Communication between renderer and main processes

**Note**: Previously used `generic-filehandle` but switched to direct path-based approach to avoid buffer compatibility issues.

## Key Features

### 1. Automatic BAM Detection
- Detects BAM files by extension (.bam)
- Automatically switches to BAM processing mode
- Supports both indexed (with .bai) and non-indexed BAM files

### 2. Index Support
- Automatically detects BAI index files
- Supports both `.bam.bai` and `.bai` naming conventions
- Optimized performance for indexed files

### 3. Error Handling
- Comprehensive error handling with user-friendly messages
- Graceful fallbacks for missing indexes
- Input validation for genomic coordinates

### 4. Memory Management
- Caching of BAM file instances for performance
- Automatic cleanup on application exit
- Range limits to prevent excessive memory usage (10MB max range)

## Usage

### Basic Usage

```javascript
// Automatic detection when loading BAM files
const fileManager = new FileManager();
await fileManager.loadFile('/path/to/file.bam');
```

### Direct BamReader Usage

```javascript
const bamReader = new BamReader();

// Initialize with BAM file
await bamReader.initialize('/path/to/file.bam');

// Get reads for a region
const reads = await bamReader.getReadsForRegion('chr1', 1000, 2000);

// Get file statistics
const stats = bamReader.getStats();
console.log(`File has ${stats.totalReads} reads`);
```

## Technical Details

### BAM File Initialization

```javascript
// Main process handler
ipcMain.handle('bam-initialize', async (event, filePath) => {
  const bamFile = new BamFile({
    bamPath: filePath,
    baiPath: baiPath, // if available
    cacheSize: 100,
    yieldThreadTime: 100
  });
  
  const header = await bamFile.getHeader();
  return { success: true, header, references, totalReads, fileSize };
});
```

### Reading BAM Records

```javascript
// Main process handler
ipcMain.handle('bam-get-reads', async (event, params) => {
  const { filePath, chromosome, start, end } = params;
  const bamFile = bamFiles.get(filePath);
  
  const records = await bamFile.getRecordsForRange(chromosome, start, end);
  
  // Convert to internal format
  const reads = records.map(record => ({
    id: record.name,
    chromosome: record.refName,
    start: record.start,
    end: record.end,
    strand: record.strand === 1 ? '+' : '-',
    // ... other fields
  }));
  
  return { success: true, reads };
});
```

## Integration Points

### FileManager Integration

```javascript
// src/renderer/modules/FileManager.js
if (fileName.toLowerCase().endsWith('.bam')) {
  console.log('BAM file detected, initializing BAM reader...');
  this.bamReader = new BamReader();
  await this.bamReader.initialize(filePath);
  
  this.fileType = 'BAM';
  this.mode = 'bam';
  // ... rest of initialization
}
```

### ReadsManager Integration

```javascript
// src/renderer/modules/ReadsManager.js
async initializeWithBAMReader(bamReader) {
  this.bamReader = bamReader;
  this.mode = 'bam';
  // Initialize visualization components
}

async loadReadsForRegionBAM(chromosome, start, end) {
  const reads = await this.bamReader.getReadsForRegion(chromosome, start, end);
  return this.processReads(reads);
}
```

## Error Resolution

### Buffer Type Error Fix

**Problem**: "The 'buffer' argument must be an instance of Buffer, TypedArray, or DataView. Received type number"

**Solution**: 
- Switched from `generic-filehandle` to direct path-based approach
- Use `bamPath` and `baiPath` parameters instead of filehandle objects
- This avoids buffer compatibility issues between different module versions

### Before (Problematic):
```javascript
const bamFile = new BamFile({
  bamFilehandle: new LocalFile(filePath),
  baiFilehandle: new LocalFile(baiPath)
});
```

### After (Fixed):
```javascript
const bamFile = new BamFile({
  bamPath: filePath,
  baiPath: baiPath
});
```

## Performance Optimizations

### 1. Caching
- BAM file instances are cached in the main process
- Reduces initialization overhead for repeated access

### 2. Index Usage
- Automatic BAI index detection and utilization
- Significantly improves query performance for large files

### 3. Range Limiting
- Maximum query range of 10MB to prevent memory issues
- Protects against excessive memory usage

### 4. Error Recovery
- Graceful handling of missing references
- Continues processing even if individual records fail

## File Format Support

### Supported Features
- ✅ BAM format v1.0+
- ✅ BAI index files
- ✅ Standard and alternative index naming
- ✅ All standard BAM fields (QNAME, FLAG, RNAME, POS, MAPQ, CIGAR, etc.)
- ✅ Read tags and metadata

### Limitations
- ❌ CSI index format (not currently supported)
- ❌ CRAM format (separate implementation needed)
- ❌ Streaming for extremely large regions (loads all into memory)

## Troubleshooting

### Common Issues

1. **File Not Found**
   - Ensure BAM file path is correct
   - Check file permissions

2. **Missing Index**
   - BAI files improve performance but are not required
   - Create index with: `samtools index file.bam`

3. **Performance Issues**
   - Use BAI index for large files
   - Limit query ranges to reasonable sizes
   - Consider chromosome-level queries instead of genome-wide

4. **Memory Issues**
   - Reduce query range size
   - Ensure sufficient system memory
   - Monitor memory usage in large datasets

### Debug Mode

Enable debug logging by setting environment variable:
```bash
DEBUG=bam* npm start
```

## Future Enhancements

1. **Streaming Support**: Implement streaming for very large regions
2. **CSI Index Support**: Add support for CSI index format
3. **CRAM Support**: Implement CRAM file format support
4. **Performance Monitoring**: Add real-time performance metrics
5. **Progress Reporting**: Show progress for large file operations

## Testing

### Test Files
- Include both indexed and non-indexed BAM files
- Test various chromosome naming conventions
- Test edge cases (empty regions, invalid coordinates)

### Validation
- Verify read counts match samtools output
- Validate coordinate transformations
- Check memory usage patterns

## References

- [SAM/BAM Format Specification](https://samtools.github.io/hts-specs/)
- [@gmod/bam Documentation](https://github.com/GMOD/bam-js)
- [Electron IPC Documentation](https://www.electronjs.org/docs/api/ipc-main) 