# Track Splitters - Resizable Track Visualization

## Overview

The Electron Genome Browser now includes resizable splitters between each track, allowing users to customize the height of individual tracks for better visualization of their genomic data.

## Features

### Visual Splitters
- **Horizontal splitters** appear between each track when multiple tracks are displayed
- **Visual indicator** (⋯) shows where splitters can be dragged
- **Hover effects** make splitters more prominent when mouse is over them
- **Tooltip hints** show "Double-click to auto-adjust" on hover
- **Responsive design** adapts to different screen sizes

### Resizing Functionality
- **Mouse drag**: Click and drag splitters up/down to resize tracks
- **Double-click**: Auto-adjusts the upper track to optimal height based on content
- **Touch support**: Works on mobile devices with touch gestures
- **Keyboard navigation**: Use Arrow Up/Down keys when splitter is focused
- **Minimum heights**: Tracks maintain minimum functional heights (30px minimum)

### Auto-Adjust Feature
- **Smart sizing**: Double-click any splitter to automatically resize the upper track
- **Content-aware**: Calculates optimal height based on track type and content:
  - **Gene tracks**: Adjusts based on number of gene rows and maximum vertical position
  - **Reads tracks**: Adjusts based on number of read alignment rows
  - **Sequence tracks**: Fixed optimal height (40px)
  - **GC Content tracks**: Fixed optimal height (70px)
  - **Variant tracks**: Fixed optimal height (50px)
  - **Protein tracks**: Fixed optimal height (60px)
- **Visual feedback**: Green animation effect during auto-adjustment
- **Smooth transitions**: 0.3-second animation for height changes

## Usage Instructions

### Basic Resizing
1. **Locate splitters**: Look for horizontal bars with three dots (⋯) between tracks
2. **Drag to resize**: Click and drag splitters up or down to adjust track heights
3. **Release**: Drop the splitter at desired position

### Auto-Adjust
1. **Double-click splitter**: Double-click any track splitter
2. **Watch animation**: Green highlight indicates auto-adjustment in progress
3. **Optimal sizing**: Upper track automatically resizes to fit content perfectly

### Keyboard Controls
1. **Focus splitter**: Tab to navigate to a track splitter
2. **Resize with arrows**: Use ↑/↓ arrow keys to resize in 10px increments
3. **Auto-adjust**: Press Enter or Space bar to trigger auto-adjustment

## Track-Specific Behavior

### Gene Tracks
- Auto-adjust calculates height based on gene element positions
- Accounts for multi-row layouts to prevent overlapping
- Adds padding for visual clarity

### Reads Tracks  
- Considers alignment row distribution
- Optimizes for multi-row read layouts
- Maintains readability of alignment data

### Fixed-Height Tracks
- Sequence, GC Content, Variant, and Protein tracks use predefined optimal heights
- Consistent sizing for better visual alignment
- Maintains functional display requirements

## Visual Feedback

### Hover States
- Splitters become more prominent when hovered
- Tooltip appears showing double-click hint
- Handle (⋯) becomes larger and more visible

### Active States
- Dragging shows visual feedback with darker colors
- Auto-adjusting displays green animation
- Focus states show blue outline for accessibility

### Responsive Design
- Mobile devices hide tooltips for cleaner interface
- Touch-friendly splitter sizes on smaller screens
- Keyboard navigation fully supported

## Technical Details

### Minimum Heights
- All tracks maintain minimum 30px height during resizing
- Specific minimums per track type:
  - Gene tracks: 60px minimum
  - Sequence tracks: 40px minimum  
  - GC Content tracks: 50px minimum
  - Reads tracks: 40px minimum
  - Variant tracks: 40px minimum
  - Protein tracks: 50px minimum

### Performance
- Smooth 60fps animations using CSS transitions
- Efficient DOM manipulation during resizing
- Optimized content height calculations

### Accessibility
- Full keyboard navigation support
- ARIA labels for screen readers
- Focus indicators for visual accessibility
- Semantic role attributes

## Tips for Best Experience

1. **Use auto-adjust first**: Double-click splitters to get optimal sizing, then fine-tune manually if needed
2. **Consider content density**: Dense tracks (many genes/reads) benefit from larger heights
3. **Maintain proportions**: Keep related tracks at similar heights for visual consistency
4. **Mobile usage**: Use touch gestures for resizing on mobile devices
5. **Keyboard shortcuts**: Use Tab + Arrow keys for precise adjustments

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