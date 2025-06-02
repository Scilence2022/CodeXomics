# WIG Tracks Implementation in Genome AI Studio

## Overview

This document describes the implementation of WIG (Wiggle) format support in Genome AI Studio. WIG files are used to display continuous data such as ChIP-seq, RNA-seq, methylation data, and other quantitative genomic datasets.

## Features Implemented

### 1. WIG Format Support
- **Fixed Step Format**: Regular intervals with consistent step size
- **Variable Step Format**: Irregular intervals with position-value pairs
- **Track Headers**: Support for track metadata and descriptions
- **Multiple Chromosomes**: Support for multi-chromosome WIG files

### 2. File Management Integration
- Added `.wig` extension to supported file types
- Integrated WIG parser in `FileManager.js`
- File menu options for opening WIG files
- Welcome screen integration

### 3. Track Visualization
- Interactive bar chart visualization
- Hover tooltips showing position and value
- Responsive design for different screen sizes
- Color-coded data representation

### 4. User Interface
- Track checkboxes in toolbar and sidebar
- File menu integration
- Welcome screen buttons
- Consistent styling with existing tracks

## File Structure

### Core Implementation Files

```
src/renderer/modules/
├── FileManager.js          # WIG file parsing and loading
├── TrackRenderer.js        # WIG track creation and rendering
└── renderer-modular.js     # Main integration and event handling

src/renderer/
├── index.html             # UI elements and controls
└── styles.css             # WIG track styling

test_data/
├── sample.wig             # Fixed step sample data
└── variable_sample.wig    # Variable step sample data
```

## Technical Implementation

### 1. WIG Parser (`FileManager.js`)

The WIG parser supports both fixed step and variable step formats:

```javascript
parseWIG(content) {
    const tracks = [];
    const lines = content.split('\n');
    let currentTrack = null;
    let currentChromosome = null;
    let currentStep = null;
    let currentSpan = null;
    let currentStart = null;
    let position = 0;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;

        if (trimmedLine.startsWith('track')) {
            // Parse track header
            currentTrack = this.parseTrackHeader(trimmedLine);
            tracks.push(currentTrack);
        } else if (trimmedLine.startsWith('fixedStep')) {
            // Parse fixed step declaration
            const params = this.parseStepParams(trimmedLine);
            currentChromosome = params.chrom;
            currentStart = parseInt(params.start) || 1;
            currentStep = parseInt(params.step) || 1;
            currentSpan = parseInt(params.span) || 1;
            position = currentStart;
        } else if (trimmedLine.startsWith('variableStep')) {
            // Parse variable step declaration
            const params = this.parseStepParams(trimmedLine);
            currentChromosome = params.chrom;
            currentSpan = parseInt(params.span) || 1;
        } else if (!isNaN(parseFloat(trimmedLine))) {
            // Data line
            if (currentTrack && currentChromosome) {
                const value = parseFloat(trimmedLine);
                currentTrack.data.push({
                    chromosome: currentChromosome,
                    start: position,
                    end: position + currentSpan - 1,
                    value: value
                });
                position += currentStep;
            }
        } else if (trimmedLine.includes(' ')) {
            // Variable step data (position value)
            const parts = trimmedLine.split(/\s+/);
            if (parts.length >= 2 && currentTrack && currentChromosome) {
                const pos = parseInt(parts[0]);
                const value = parseFloat(parts[1]);
                currentTrack.data.push({
                    chromosome: currentChromosome,
                    start: pos,
                    end: pos + currentSpan - 1,
                    value: value
                });
            }
        }
    }

    return tracks;
}
```

### 2. Track Rendering (`TrackRenderer.js`)

The track renderer creates interactive visualizations:

```javascript
createWIGTrack(chromosome) {
    const trackDiv = document.createElement('div');
    trackDiv.className = 'wig-track';
    
    const header = this.createTrackHeader('WIG Tracks', 'wigTracks');
    const content = document.createElement('div');
    content.className = 'track-content';
    
    if (this.genomeBrowser.wigTracks && this.genomeBrowser.wigTracks.length > 0) {
        const visualization = this.createWIGVisualization(chromosome);
        content.appendChild(visualization);
        
        const legend = this.createWIGLegend();
        content.appendChild(legend);
    } else {
        content.innerHTML = `
            <div class="no-wig-message">
                <i class="fas fa-chart-line"></i>
                <div>No WIG tracks loaded</div>
                <small>Load a WIG file to see quantitative data visualization</small>
            </div>
        `;
    }
    
    trackDiv.appendChild(header);
    trackDiv.appendChild(content);
    
    return trackDiv;
}
```

### 3. Data Visualization

The visualization creates interactive bar charts with:
- Proportional bar heights based on data values
- Hover tooltips with position and value information
- Responsive scaling based on viewport
- Color gradients for visual appeal

### 4. UI Integration

#### Track Controls
- Toolbar checkboxes for quick track toggling
- Sidebar controls for detailed track management
- File menu options for opening WIG files

#### Event Handling
- Track visibility toggling
- File loading through multiple entry points
- Responsive updates when data changes

## Usage Examples

### 1. Loading WIG Files

Users can load WIG files through:
- **File Menu**: File → WIG Tracks (WIG)
- **Welcome Screen**: "WIG Tracks" button
- **Drag & Drop**: Direct file dropping (if implemented)

### 2. Sample WIG Formats

#### Fixed Step Format
```
track type=wiggle_0 name="Sample ChIP-seq" description="Sample ChIP-seq data"
fixedStep chrom=chr1 start=1000 step=100 span=100
0.5
1.2
2.1
3.4
```

#### Variable Step Format
```
track type=wiggle_0 name="Variable Step Data" description="Sample variable step data"
variableStep chrom=chr1 span=50
1000 1.5
1100 2.3
1250 3.1
1400 2.8
```

### 3. Track Interaction

- **Hover**: Shows tooltips with position and value
- **Toggle**: Use checkboxes to show/hide tracks
- **Resize**: Tracks support resizing through splitters

## Styling and Theming

### CSS Classes
- `.wig-track`: Main track container
- `.wig-visualization`: Data visualization area
- `.wig-bar`: Individual data bars
- `.wig-tooltip`: Hover tooltips
- `.wig-legend`: Track legend and statistics

### Responsive Design
- Mobile-optimized layouts
- Scalable visualizations
- Touch-friendly interactions

### Dark Mode Support
- Automatic theme detection
- Consistent color schemes
- Proper contrast ratios

## Testing

### Sample Data
Two test files are provided:
- `test_data/sample.wig`: Fixed step format example
- `test_data/variable_sample.wig`: Variable step format example

### Testing Procedure
1. Start the application: `npm start`
2. Load a WIG file through any entry point
3. Enable WIG tracks in the track controls
4. Verify visualization appears correctly
5. Test hover interactions and tooltips
6. Test track toggling and resizing

## Future Enhancements

### Planned Features
1. **BigWig Support**: Large file format support
2. **Multiple Track Overlays**: Compare multiple datasets
3. **Data Filtering**: Value-based filtering options
4. **Export Functionality**: Save visualizations as images
5. **Statistical Analysis**: Built-in data analysis tools

### Performance Optimizations
1. **Data Binning**: For large datasets
2. **Virtual Scrolling**: For long chromosomes
3. **Caching**: Improve rendering performance
4. **WebGL Rendering**: Hardware acceleration

## Integration Points

### With Existing Features
- **Search**: Find regions with specific values
- **Navigation**: Jump to data peaks/valleys
- **Annotations**: Correlate with gene features
- **Chat Integration**: AI analysis of WIG data

### API Compatibility
- Standard WIG format compliance
- UCSC Genome Browser compatibility
- IGV format support

## Troubleshooting

### Common Issues
1. **File Not Loading**: Check file format and syntax
2. **No Visualization**: Ensure track is enabled in controls
3. **Performance Issues**: Consider data size and browser limits
4. **Styling Problems**: Check CSS conflicts and browser compatibility

### Debug Information
- Console logs for parsing errors
- Track loading status indicators
- Data validation warnings

## Conclusion

The WIG tracks implementation provides comprehensive support for quantitative genomic data visualization in Genome AI Studio. The modular design allows for easy extension and integration with existing features while maintaining performance and usability standards.

For questions or issues, refer to the main project documentation or submit issues through the project repository. 