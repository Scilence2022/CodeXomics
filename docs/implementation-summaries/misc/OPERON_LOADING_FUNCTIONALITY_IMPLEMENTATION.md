# Operon Loading Functionality Implementation

## Overview

This document describes the implementation of a separate operon file loading functionality in GenomeExplorer, allowing users to load operon information independently from genome files. This feature provides enhanced flexibility in data management and analysis workflows.

## Implementation Date

December 2024

## Feature Description

The operon loading functionality enables users to:
- Load operon data from external files in multiple formats (JSON, CSV, TXT)
- Display loaded operons in the genome view with proper visual representation
- View operon information in the dedicated operon panel
- Override auto-detected operons with user-provided data
- Maintain operon data across genome navigation and analysis

## Technical Implementation

### Files Modified

1. **src/renderer/index.html**
   - Added "Operon File (JSON, CSV, TXT)" option to Load File dropdown menu
   - Added appropriate icon (sitemap) and styling

2. **src/renderer/renderer-modular.js**
   - Added event listener for operon file loading
   - Added `loadedOperons` property to GenomeBrowser class
   - Modified `detectOperons()` method to prioritize loaded operons
   - Added `mapOperonGenesToAnnotations()` method for gene mapping

3. **src/renderer/modules/FileManager.js**
   - Added `loadOperonFile()` method for operon file loading
   - Implemented parsing methods for different file formats:
     - `parseOperonJSON()` - JSON format parsing
     - `parseOperonCSV()` - CSV format parsing
     - `parseOperonTXT()` - TXT format parsing
   - Added `normalizeOperonData()` for data validation
   - Added `updateOperonPanel()` for UI updates

### Supported File Formats

#### JSON Format
```json
[
  {
    "name": "lac_operon",
    "start": 1000,
    "end": 5000,
    "strand": 1,
    "genes": ["lacZ", "lacY", "lacA"],
    "chromosome": "chr1",
    "description": "Lactose operon",
    "confidence": 0.95
  }
]
```

#### CSV Format
```csv
operon_name,start,end,strand,genes,chromosome
lac_operon,1000,5000,+,lacZ;lacY;lacA,chr1
trp_operon,8000,12000,-,trpE;trpD;trpC;trpB;trpA,chr1
```

#### TXT Format
```txt
# Operon data file
# Format: name start end strand genes chromosome
lac_operon	1000	5000	+	lacZ,lacY,lacA	chr1
trp_operon	8000	12000	-	trpE,trpD,trpC,trpB,trpA	chr1
```

### Data Structure

The normalized operon data structure includes:
- `name`: Operon identifier
- `start`: Start position (1-based)
- `end`: End position (1-based)
- `strand`: Strand direction (1 for +, -1 for -)
- `genes`: Array of gene names
- `chromosome`: Chromosome identifier
- `description`: Optional description
- `confidence`: Confidence score (0-1)
- `source`: Data source identifier

### Key Features

#### 1. Format Detection and Parsing
- Automatic format detection based on file extension
- Robust parsing with error handling for malformed files
- Support for multiple JSON structures (array, object with operons property)
- Flexible CSV parsing with optional headers
- Tab-separated and space-separated TXT formats

#### 2. Data Integration
- Seamless integration with existing operon detection system
- Gene mapping to annotation features
- Automatic fallback to auto-detection when no operons are loaded
- Data clearing when new genome files are loaded

#### 3. User Interface
- Intuitive file selection through dropdown menu
- Real-time status updates during loading
- Success/error notifications
- Operon panel updates with loaded data

#### 4. Error Handling
- Comprehensive validation of operon data
- Graceful handling of malformed files
- User-friendly error messages
- Fallback mechanisms for missing data

## Usage Instructions

### Loading Operon Files

1. **Access the Feature**
   - Click on "Load File" dropdown in the main interface
   - Select "Operon File (JSON, CSV, TXT)" from the menu

2. **Select File Format**
   - Choose a file with supported extension (.json, .csv, .txt, .operon)
   - The system will automatically detect and parse the format

3. **View Results**
   - Operons will appear in the genome view with color coding
   - Operon panel will display detailed information
   - Status bar will show the number of loaded operons

### File Format Requirements

#### Required Fields
- `name`: Operon identifier
- `start`: Start position (integer)
- `end`: End position (integer)
- `strand`: Strand direction (+ or -, or 1 or -1)

#### Optional Fields
- `genes`: Array or comma-separated string of gene names
- `chromosome`: Chromosome identifier
- `description`: Human-readable description
- `confidence`: Confidence score (0-1)

## Integration with Existing Systems

### Operon Detection
- Loaded operons take precedence over auto-detected operons
- When no operons are loaded, system falls back to proximity-based detection
- Gene mapping connects operon genes with annotation features

### Track Rendering
- Operons are displayed using existing color assignment system
- Integration with operon panel for detailed information
- Consistent visual representation across genome view

### Data Management
- Automatic clearing of loaded operons when new genome files are loaded
- Preservation of operon data during genome navigation
- Integration with tab management system

## Testing

### Test Suite
A comprehensive test suite is provided in `test/test-operon-loading-functionality.html` including:
- Sample data files in all supported formats
- Test scenarios for different use cases
- Error handling validation
- Performance testing guidelines

### Test Scenarios
1. **Basic Loading**: Load operon files and verify display
2. **Format Validation**: Test all supported file formats
3. **Integration Testing**: Load operons with genome data
4. **Error Handling**: Test invalid files and missing data
5. **Performance Testing**: Test with large files and complex data

## Performance Considerations

### File Size Limits
- No hard limits on file size
- Memory usage scales with operon count
- Efficient parsing algorithms for large files

### Rendering Performance
- Operons are rendered using existing optimized systems
- Color assignment uses efficient mapping algorithms
- Minimal impact on genome view performance

## Future Enhancements

### Potential Improvements
1. **Additional Formats**: Support for GFF3, BED, and other genomic formats
2. **Validation Tools**: Built-in operon data validation and correction
3. **Export Functionality**: Export loaded operons in various formats
4. **Batch Operations**: Load multiple operon files simultaneously
5. **Advanced Filtering**: Filter operons by confidence, chromosome, etc.

### Integration Opportunities
1. **Database Connectivity**: Direct loading from operon databases
2. **API Integration**: Real-time operon data fetching
3. **Machine Learning**: Automated operon prediction and validation
4. **Collaborative Features**: Sharing operon annotations

## Troubleshooting

### Common Issues

#### File Loading Errors
- **Invalid Format**: Ensure file matches expected format structure
- **Missing Fields**: Check that required fields are present
- **Encoding Issues**: Use UTF-8 encoding for text files

#### Display Issues
- **Operons Not Showing**: Verify operon coordinates are within genome range
- **Color Issues**: Check that operon names are unique
- **Gene Mapping**: Ensure gene names match annotation features

#### Performance Issues
- **Slow Loading**: Consider file size and system resources
- **Memory Usage**: Monitor memory consumption with large files
- **Rendering Delays**: Check for complex operon structures

### Debug Information
- Console logs provide detailed loading information
- Error messages include specific failure reasons
- Status bar shows loading progress and results

## Conclusion

The operon loading functionality significantly enhances GenomeExplorer's capabilities by providing flexible operon data management. The implementation maintains compatibility with existing systems while adding powerful new features for operon analysis and visualization.

The feature is production-ready and includes comprehensive error handling, testing, and documentation. Users can now load operon information from external sources, providing greater flexibility in genomic analysis workflows.

## Related Documentation

- [GenomeExplorer User Guide](../project-guides/)
- [File Format Specifications](../project-guides/)
- [API Documentation](../project-guides/)
- [Test Suite Documentation](../test/)

## Version History

- **v1.0.0** (December 2024): Initial implementation with JSON/CSV/TXT support
