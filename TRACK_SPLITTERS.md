# Track Splitters - Resizable Track Visualization

## Overview

The Electron Genome Browser now includes resizable splitters between each track, allowing users to customize the height of individual tracks for better visualization of their genomic data.

## Features

### Visual Splitters
- **Horizontal splitters** appear between each track when multiple tracks are displayed
- **Visual indicator** (⋯) shows where splitters can be dragged
- **Hover effects** make splitters more prominent when mouse is over them
- **Responsive design** adapts to different screen sizes

### Resizing Functionality
- **Mouse drag**: Click and drag splitters up/down to resize tracks
- **Touch support**: Works on mobile devices with touch gestures
- **Keyboard navigation**: Use Arrow Up/Down keys when splitter is focused
- **Minimum heights**: Tracks maintain minimum heights to ensure usability

### Accessibility
- **Keyboard accessible**: Splitters can be focused with Tab key
- **ARIA labels**: Screen readers can identify splitters as "Resize tracks"
- **Visual feedback**: Clear focus indicators and cursor changes

## How to Use

### Basic Resizing
1. Load a genome file (FASTA, GenBank, etc.)
2. Enable multiple tracks from the toolbar or sidebar
3. Look for horizontal splitter bars between tracks
4. Click and drag splitters to adjust track heights

### Keyboard Navigation
1. Press Tab to focus on a splitter
2. Use Arrow Up to make the top track smaller
3. Use Arrow Down to make the top track larger
4. Press Tab again to move to the next splitter

### Track Types with Splitters
- **Genes & Features Track** ↔ **Sequence Track**
- **Sequence Track** ↔ **GC Content Track**
- **GC Content Track** ↔ **Variants Track**
- **Variants Track** ↔ **Aligned Reads Track**
- **Aligned Reads Track** ↔ **Protein Track**

## Technical Details

### Minimum Heights
Each track type has a minimum height to ensure functionality:
- Gene Track: 60px minimum
- Sequence Track: 40px minimum
- GC Content Track: 50px minimum
- Reads Track: 40px minimum
- Variant Track: 40px minimum
- Protein Track: 50px minimum

### Responsive Behavior
- On mobile devices (< 768px), splitters are larger for easier touch interaction
- Splitter handles scale appropriately for different screen sizes
- Touch events are supported for mobile and tablet devices

### Performance
- Smooth animations with CSS transitions
- Efficient event handling to prevent performance issues
- Throttled updates during dragging for better responsiveness

## Example Use Cases

### 1. Detailed Gene Analysis
- Make the Genes & Features track taller to see gene names clearly
- Reduce other tracks to focus on gene annotations
- Useful for studying operons and gene clusters

### 2. Sequence Examination
- Expand the Sequence track to see individual nucleotides
- Minimize other tracks when focusing on sequence details
- Helpful for mutation analysis and sequence verification

### 3. Read Coverage Analysis
- Increase the Aligned Reads track height to see read stacking
- Useful for identifying coverage gaps and read distribution
- Essential for variant calling and assembly validation

### 4. Multi-track Comparison
- Balance all track heights for comprehensive view
- Compare GC content with gene density
- Correlate variants with read coverage

## Troubleshooting

### Splitters Not Visible
- Ensure multiple tracks are enabled
- Check that tracks contain data for the current region
- Verify that the genome file has been loaded successfully

### Resizing Not Working
- Make sure you're clicking on the splitter bar (⋯ symbol)
- Try using keyboard navigation as an alternative
- Check that tracks have content to resize

### Performance Issues
- Reduce the number of visible tracks if experiencing lag
- Use smaller genomic regions for better performance
- Close unnecessary browser tabs to free up memory

## File Compatibility

The track splitter functionality works with all supported file formats:
- **Genome files**: FASTA (.fa, .fasta), GenBank (.gb, .gbk, .gbff)
- **Annotation files**: GFF (.gff), BED (.bed)
- **Variant files**: VCF (.vcf)
- **Read files**: SAM (.sam), BAM (.bam)

## Future Enhancements

Planned improvements for track splitters:
- Save/restore track height preferences
- Preset track height configurations
- Double-click to auto-size tracks
- Proportional resizing options 