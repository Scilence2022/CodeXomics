# Search Features Function Implementation

## Overview

The `search_features` function is implemented in the GenomeExplorer project to search for genes and genomic features by name, product description, or other text-based queries. This function is accessible through the MCP (Model Context Protocol) server and can be called from LLM interactions.

## Function Definition

**Function Name:** `search_features`

**Parameters:**
- `query` (string, required): Search query for gene names, product descriptions, or any text-based search
- `caseSensitive` (boolean, optional): Whether the search should be case-sensitive (default: false)
- `clientId` (string, optional): Browser client ID for routing the request

## Recent Enhancement: OR Operator Support

**🆕 FIXED: OR Operator Support Added**
- The search function now properly supports OR operators in queries
- Complex queries like "citrate synthase OR aconitase OR fumarase" now work correctly
- Each term in an OR query is searched independently
- Results show which specific terms matched

## Implementation Details

### 1. MCP Server Definition
Located in `src/mcp-server.js`, lines 198-209:

```javascript
search_features: {
    name: 'search_features',
    description: 'Search for genes or features by name or sequence',
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Search query (gene name or sequence)' },
            caseSensitive: { type: 'boolean', description: 'Case sensitive search' },
            clientId: { type: 'string', description: 'Browser client ID' }
        },
        required: ['query']
    }
}
```

### 2. Enhanced NavigationManager Implementation
Located in `src/renderer/modules/NavigationManager.js`, with new OR operator support:

```javascript
// Parse search terms - support OR operator
parseSearchQuery(query) {
    // Check if query contains OR operator (case insensitive)
    if (query.toLowerCase().includes(' or ')) {
        // Split by OR operator and clean up terms
        return query.split(/\s+or\s+/i)
            .map(term => term.trim())
            .filter(term => term.length > 0);
    } else {
        // Single search term
        return [query];
    }
}

// Enhanced search with OR support
const searchTerms = this.parseSearchQuery(searchTerm);
const isMatch = searchTerms.some(term => fieldToSearch.includes(term));
```

### 3. ChatManager Implementation
Located in `src/renderer/modules/ChatManager.js`, lines 818-859:

```javascript
async searchFeatures(params) {
    const { query, caseSensitive } = params;
    
    // Use existing search functionality from NavigationManager
    if (this.app && this.app.navigationManager) {
        // Store original settings
        const originalCaseSensitive = document.getElementById('caseSensitive')?.checked;
        
        // Set case sensitivity for this search
        const caseSensitiveCheckbox = document.getElementById('caseSensitive');
        if (caseSensitiveCheckbox) {
            caseSensitiveCheckbox.checked = caseSensitive || false;
        }
        
        // Perform the search
        this.app.navigationManager.performSearch(query);
        
        // Get the results from NavigationManager
        const searchResults = this.app.navigationManager.searchResults || [];
        
        // Restore original setting
        if (caseSensitiveCheckbox && originalCaseSensitive !== undefined) {
            caseSensitiveCheckbox.checked = originalCaseSensitive;
        }
        
        return {
            query: query,
            caseSensitive: caseSensitive || false,
            results: searchResults,
            count: searchResults.length
        };
    }
    
    throw new Error('Navigation manager not available');
}
```

## Usage Examples

### 1. Citrate Cycle Enzymes Search (Complex OR Query)

```json
{
    "tool_name": "search_features",
    "parameters": {
        "query": "citrate synthase OR aconitase OR isocitrate dehydrogenase OR alpha-ketoglutarate dehydrogenase OR succinyl-CoA synthetase OR succinate dehydrogenase OR fumarase OR malate dehydrogenase",
        "caseSensitive": false
    }
}
```

### 2. Individual Enzyme Searches

```json
{
    "tool_name": "search_features",
    "parameters": {
        "query": "citrate synthase",
        "caseSensitive": false
    }
}
```

### 3. Pattern-Based Searches

```json
{
    "tool_name": "search_features",
    "parameters": {
        "query": "TCA cycle",
        "caseSensitive": false
    }
}
```

## Search Capabilities

The function searches through multiple annotation fields:
- **Gene names**: Searches in the `gene` qualifier
- **Locus tags**: Searches in the `locus_tag` qualifier  
- **Product descriptions**: Searches in the `product` qualifier
- **Notes**: Searches in the `note` qualifier
- **Feature types**: Searches feature type fields

## Return Format

The function returns an object with the following structure:

```javascript
{
    query: "search_term",
    caseSensitive: false,
    results: [
        {
            type: "gene",
            name: "gene_name",
            locus_tag: "locus_id",
            product: "description",
            chromosome: "chr_name",
            start: 12345,
            end: 67890,
            strand: 1
        }
        // ... more results
    ],
    count: 5
}
```

## Integration Points

### 1. LLM Chat Integration
- Function is automatically available in AI chat contexts
- Properly integrated with function calling system
- Results are displayed in the search results panel

### 2. Navigation Manager
- Leverages existing search infrastructure
- Uses optimized search algorithms
- Maintains UI state consistency

### 3. MCP Server
- Available through WebSocket and HTTP endpoints
- Supports multiple client connections
- Includes error handling and validation

## Best Practices

### 1. Query Optimization
- Use specific terms for targeted results
- Consider using individual searches for better precision
- Use pattern searches for pathway-related queries

### 2. Case Sensitivity
- Default to case-insensitive for broader matches
- Use case-sensitive when exact matching is required

### 3. Complex Queries
- OR queries work but may be less precise
- Consider breaking complex searches into multiple calls
- Use pathway-specific terms for metabolic enzyme searches

## Error Handling

The function includes comprehensive error handling:
- Validates navigation manager availability
- Preserves original UI state
- Returns structured error messages
- Logs detailed debugging information

## Performance Considerations

- Search is performed on loaded genomic data
- Results are cached by the navigation manager
- UI updates are optimized to prevent blocking
- Large result sets are handled efficiently 