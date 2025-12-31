# UniProt Database API Integration Implementation

## Overview
This document describes the complete implementation of real UniProt database API integration in GenomeExplorer through the MCP (Model Context Protocol) Server. The implementation provides authentic UniProt database search capabilities with comprehensive data retrieval and visualization.

## Architecture

### MCP Server Implementation (`src/mcp-server.js`)

#### New Function Calls Added

1. **search_uniprot_database**
   - **Purpose**: Primary UniProt search with various search types and filters
   - **Search Types**: 
     - `protein_name`: Search by protein name
     - `gene_name`: Search by gene symbol (e.g., TP53, INS)
     - `uniprot_id`: Search by UniProt accession ID
     - `organism`: Search by species name
     - `keyword`: Search by functional keywords
     - `annotation`: Search in functional annotations
     - `sequence`: Search by protein sequence similarity
   - **Filters**: organism, reviewedOnly, minLength, maxLength, limit
   - **Returns**: Formatted protein entries with sequences, features, and metadata

2. **advanced_uniprot_search**
   - **Purpose**: Multi-field search with complex query building
   - **Parameters**: proteinName, geneName, organism, keywords, subcellularLocation, function
   - **Features**: Boolean query construction, comprehensive filtering
   - **Returns**: Advanced search results with detailed annotations

3. **get_uniprot_entry**
   - **Purpose**: Fetch detailed information for specific UniProt entries
   - **Features**: Complete protein data including sequences, features, cross-references
   - **Options**: includeSequence, includeFeatures, includeCrossRefs
   - **Returns**: Comprehensive protein entry details

#### API Integration Features

- **Real UniProt REST API**: Uses `rest.uniprot.org` endpoints
- **Proper Query Building**: Constructs valid UniProt query syntax
- **Field Selection**: Optimized API calls with specific field requests
- **Error Handling**: Comprehensive error management and fallbacks
- **Data Processing**: Intelligent parsing and formatting of UniProt responses

#### Helper Methods

- `extractProteinName()`: Parse protein name from API response
- `extractGeneNames()`: Extract gene names and synonyms
- `extractProteinFunction()`: Parse functional annotations
- `extractProteinFeatures()`: Process protein features and domains
- `extractSubcellularLocation()`: Parse localization data
- `extractGOTerms()`: Extract Gene Ontology annotations
- `extractCrossReferences()`: Parse database cross-references
- `calculateSequenceSimilarity()`: Simple sequence comparison

### UniProt Search Tool Enhancement (`src/bioinformatics-tools/uniprot-search.html`)

#### MCP Server Integration

- **WebSocket Connection**: Real-time connection to MCP Server on port 3001
- **Connection Management**: Auto-reconnection and fallback mechanisms
- **Request Handling**: Asynchronous API call management with request tracking
- **Response Processing**: Real-time result display and error handling

#### Enhanced User Interface

- **Connection Status**: Live connection indicator
- **Real-time Feedback**: API call progress and status updates
- **Comprehensive Results**: Rich protein data visualization
- **Fallback Mode**: Offline operation when MCP Server unavailable

#### Search Capabilities

- **Multiple Search Types**: All UniProt search types supported
- **Advanced Filtering**: Organism, review status, sequence length filters
- **Sequence Downloads**: FASTA format downloads with proper formatting
- **Data Export**: CSV export functionality with complete protein data

## Technical Implementation Details

### UniProt API Query Construction

```javascript
// Example query building for gene search
const query = `gene:${geneName} AND organism:"${organism}"`;
if (reviewedOnly) {
    query += ' AND reviewed:true';
}
if (minLength) {
    query += ` AND length:[${minLength} TO *]`;
}
```

### API Field Selection

```javascript
const fields = [
    'accession', 'id', 'protein_name', 'gene_names',
    'organism_name', 'length', 'mass', 'reviewed',
    'sequence', 'ft_domain', 'ft_region', 'cc_function'
];
```

### Data Processing Pipeline

1. **API Request**: Construct UniProt query with proper encoding
2. **Response Parsing**: Parse JSON response from UniProt API
3. **Data Extraction**: Use helper methods to extract structured data
4. **Result Formatting**: Create consistent result objects
5. **Client Response**: Send formatted data to frontend

### Error Handling Strategy

- **Network Errors**: Graceful degradation to offline mode
- **API Errors**: Informative error messages and retry mechanisms
- **Timeout Handling**: Request timeout management
- **Rate Limiting**: Respectful API usage patterns

## Usage Examples

### Basic Gene Search
```javascript
const parameters = {
    query: 'TP53',
    searchType: 'gene_name',
    organism: 'Homo sapiens',
    reviewedOnly: true,
    limit: 50
};
```

### Advanced Multi-field Search
```javascript
const parameters = {
    proteinName: 'kinase',
    organism: 'Homo sapiens',
    keywords: ['ATP-binding', 'phosphorylation'],
    reviewedOnly: true,
    limit: 25
};
```

### Detailed Entry Retrieval
```javascript
const parameters = {
    uniprotId: 'P04637',
    includeSequence: true,
    includeFeatures: true,
    includeCrossRefs: true
};
```

## Testing Framework

### Test Suite (`test-uniprot-api-integration.html`)

- **Connection Testing**: MCP Server connectivity verification
- **Basic Search Tests**: All search types with sample queries
- **Advanced Search Tests**: Multi-field search validation
- **Entry Detail Tests**: Specific UniProt ID retrieval
- **Sequence Search Tests**: Protein sequence similarity search
- **Performance Tests**: API response time and reliability testing
- **Stress Tests**: Concurrent request handling validation

### Test Categories

1. **Functional Tests**: Verify all API endpoints work correctly
2. **Performance Tests**: Measure response times and throughput
3. **Error Handling Tests**: Validate error scenarios and recovery
4. **UI Integration Tests**: Ensure proper frontend-backend integration

## Data Format Examples

### Search Result Format
```json
{
    "success": true,
    "results": [
        {
            "uniprotId": "P04637",
            "proteinName": "Cellular tumor antigen p53",
            "geneNames": [{"primary": "TP53", "synonyms": ["P53"]}],
            "organism": "Homo sapiens",
            "length": 393,
            "mass": 43653,
            "reviewed": true,
            "sequence": "MEEPQSDPSVEPPLSQETFSD...",
            "function": "Acts as a tumor suppressor...",
            "features": [
                {
                    "type": "Domain",
                    "location": {"start": 102, "end": 292},
                    "description": "DNA-binding domain"
                }
            ],
            "uniprotUrl": "https://www.uniprot.org/uniprotkb/P04637"
        }
    ],
    "totalFound": 1,
    "searchType": "gene_name",
    "searchedAt": "2024-01-01T12:00:00.000Z"
}
```

### Entry Detail Format
```json
{
    "success": true,
    "entry": {
        "uniprotId": "P04637",
        "proteinName": "Cellular tumor antigen p53",
        "organism": {
            "scientificName": "Homo sapiens",
            "taxonomyId": 9606
        },
        "sequence": {
            "value": "MEEPQSDPSVEPPLSQETFSD...",
            "length": 393,
            "molWeight": 43653
        },
        "function": "Acts as a tumor suppressor...",
        "features": [...],
        "goTerms": [...],
        "crossReferences": {...}
    }
}
```

## Benefits and Features

### Real-time Integration
- **Live API Access**: Direct connection to UniProt database
- **Up-to-date Data**: Always current protein information
- **Comprehensive Coverage**: Access to entire UniProt knowledge base

### Enhanced Search Capabilities
- **Multiple Search Types**: Gene name, protein name, ID, sequence, etc.
- **Advanced Filtering**: Organism, review status, sequence properties
- **Boolean Queries**: Complex search expressions
- **Similarity Search**: Protein sequence-based searches

### Rich Data Visualization
- **Complete Protein Information**: Names, genes, functions, features
- **Sequence Display**: Formatted protein sequences
- **Feature Annotation**: Protein domains, sites, and modifications
- **Cross-references**: Links to other databases

### User Experience
- **Real-time Feedback**: Connection status and search progress
- **Error Recovery**: Graceful fallback to offline mode
- **Data Export**: Multiple format downloads (FASTA, CSV)
- **Performance Optimization**: Fast API responses and caching

## Installation and Setup

1. **MCP Server**: Ensure MCP Server is running on port 3001
2. **Dependencies**: All required modules installed (express, ws, https)
3. **Network Access**: Internet connection for UniProt API access
4. **Browser Compatibility**: Modern browser with WebSocket support

## Future Enhancements

- **Caching Layer**: Implement result caching for improved performance
- **Batch Processing**: Support for multiple protein queries
- **Advanced Visualization**: 3D structure integration
- **Export Formats**: Additional data export options
- **Search History**: Store and recall previous searches
- **Protein Comparison**: Side-by-side protein analysis

## Conclusion

The UniProt API integration provides GenomeExplorer with professional-grade protein database search capabilities. The implementation combines real-time API access with intelligent data processing and user-friendly visualization, enabling researchers to efficiently explore protein data within the GenomeExplorer environment.

The modular architecture ensures maintainability and extensibility, while the comprehensive testing framework guarantees reliability and performance. This integration significantly enhances GenomeExplorer's bioinformatics capabilities and research value. 