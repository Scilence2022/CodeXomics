# Claude MCP Integration Implementation

## Overview

This document describes the complete implementation of Claude MCP (Model Context Protocol) integration in GenomeExplorer. The implementation provides full compatibility with Claude Desktop and other MCP-compliant clients while maintaining backward compatibility with existing WebSocket-based MCP servers.

## Architecture

### System Components

1. **Claude MCP Server** (`src/mcp-server-claude.js`)
   - Full Claude MCP protocol compliance using official TypeScript SDK
   - JSON-RPC 2.0 message format
   - Stdio transport for Claude Desktop integration
   - WebSocket transport for browser communication

2. **Enhanced MCPServerManager** (`src/renderer/modules/MCPServerManager.js`)
   - Dual protocol support (Claude MCP + Legacy WebSocket)
   - Automatic protocol detection and routing
   - Unified tool execution interface

3. **Integration Test Suite** (`test/integration-tests/test-claude-mcp-integration.html`)
   - Comprehensive testing of all 40+ tools
   - Protocol compliance validation
   - Performance benchmarking

## Implementation Details

### Claude MCP Server Architecture

```javascript
class ClaudeMCPGenomeServer {
    constructor() {
        this.server = new Server({
            name: "genome-ai-studio-server",
            version: "1.0.0"
        }, {
            capabilities: {
                tools: {}
            }
        });
    }
}
```

#### Key Features

1. **Protocol Compliance**
   - Full JSON-RPC 2.0 implementation
   - Proper initialization lifecycle
   - Standard error handling
   - Message validation

2. **Tool Registration**
   - 40+ genomics tools registered
   - Proper input schema validation
   - Comprehensive tool descriptions
   - Category-based organization

3. **Dual Transport Support**
   - Stdio transport for Claude Desktop
   - WebSocket transport for browser integration
   - Automatic protocol conversion

### Tool Categories

#### 🧭 Navigation & State (4 tools)
- `navigate_to_position`: Navigate to genomic coordinates
- `get_current_state`: Get browser state information
- `jump_to_gene`: Jump directly to gene location
- `get_genome_info`: Get comprehensive genome information

#### 🔍 Search & Discovery (3 tools)
- `search_features`: Search for genes and features
- `search_gene_by_name`: Search for specific gene by name
- `search_sequence_motif`: Search for sequence motifs

#### 🧬 Sequence Analysis (7 tools)
- `get_sequence`: Extract DNA sequences
- `compute_gc`: Calculate GC content
- `translate_dna`: Translate DNA to protein
- `reverse_complement`: Get reverse complement
- `find_orfs`: Find Open Reading Frames
- `get_coding_sequence`: Get coding sequence for genes
- `codon_usage_analysis`: Analyze codon usage patterns

#### 🧪 Protein Structure (7 tools)
- `fetch_protein_structure`: Download protein 3D structure from PDB
- `search_protein_by_gene`: Search protein structures by gene name
- `open_protein_viewer`: Open 3D protein structure viewer
- `search_alphafold_by_gene`: Search AlphaFold structures by gene
- `fetch_alphafold_structure`: Fetch AlphaFold structures
- `search_alphafold_by_sequence`: Search AlphaFold by sequence
- `open_alphafold_viewer`: Open AlphaFold structure viewer

#### 🗃️ Database Integration (6 tools)
- `search_uniprot_database`: Search UniProt database
- `advanced_uniprot_search`: Advanced UniProt search
- `get_uniprot_entry`: Get detailed UniProt entry
- `analyze_interpro_domains`: Analyze protein domains
- `search_interpro_entry`: Search InterPro database
- `get_interpro_entry_details`: Get InterPro entry details

#### 🤖 AI-Powered Tools (5 tools)
- `evo2_generate_sequence`: Generate DNA sequences
- `evo2_predict_function`: Predict gene function
- `evo2_design_crispr`: Design CRISPR systems
- `evo2_optimize_sequence`: Optimize DNA sequences
- `evo2_analyze_essentiality`: Analyze gene essentiality

#### 🔬 Advanced Analysis (3 tools)
- `blast_search`: BLAST sequence similarity search
- `analyze_region`: Analyze genomic regions
- `predict_promoter`: Predict promoter regions

#### 📊 Data Management (5 tools)
- `toggle_track`: Show/hide visualization tracks
- `create_annotation`: Create custom annotations
- `export_data`: Export sequence/annotation data
- `show_metabolic_pathway`: Display metabolic pathways
- `find_pathway_genes`: Find pathway-associated genes

### Protocol Implementation

#### Message Format

All messages follow JSON-RPC 2.0 specification:

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {
      "parameter": "value"
    }
  }
}
```

#### Tool Execution Flow

1. **Client Request**
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/call",
     "params": {
       "name": "navigate_to_position",
       "arguments": {
         "chromosome": "chr1",
         "start": 1000,
         "end": 2000
       }
     }
   }
   ```

2. **Server Response**
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "result": {
       "content": [
         {
           "type": "text",
           "text": "Successfully navigated to chr1:1000-2000"
         }
       ]
     }
   }
   ```

### Enhanced MCPServerManager

#### Dual Protocol Support

```javascript
class MCPServerManager {
    constructor() {
        // Legacy WebSocket connections
        this.connections = new Map();
        
        // Claude MCP connections
        this.claudeMCPConnections = new Map();
    }
    
    async connectToServer(serverId) {
        const server = this.servers.get(serverId);
        
        if (server.protocol === 'claude-mcp') {
            await this.connectToClaudeMCPServer(serverId, server);
        } else {
            await this.connectToWebSocketServer(serverId, server);
        }
    }
}
```

#### Automatic Protocol Detection

The system automatically detects and routes requests to the appropriate protocol handler:

```javascript
async executeToolOnServer(serverId, toolName, parameters) {
    const server = this.servers.get(serverId);
    
    if (server.protocol === 'claude-mcp') {
        return await this.executeClaudeMCPTool(serverId, toolName, parameters);
    } else {
        return await this.executeWebSocketTool(serverId, toolName, parameters);
    }
}
```

## Configuration

### Claude Desktop Integration

Add to Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "genome-ai-studio": {
      "command": "node",
      "args": ["start-claude-mcp-server.js"],
      "env": {}
    }
  }
}
```

### Server Configuration

Default server configurations in MCPServerManager:

```javascript
const defaultServers = new Map([
    ['claude-mcp-genome', {
        id: 'claude-mcp-genome',
        name: 'Claude MCP Genome Server',
        description: 'Claude MCP compliant genome analysis server',
        url: 'ws://localhost:3001',
        enabled: true,
        autoConnect: true,
        protocol: 'claude-mcp',
        mcpConfig: {
            stdio: false,
            serverPath: './src/mcp-server-claude.js'
        }
    }]
]);
```

## Usage

### Starting the Server

```bash
# Start Claude MCP server
npm run claude-mcp-server

# Start with application
npm run start-with-claude-mcp
```

### Available Scripts

- `npm run claude-mcp-server`: Start Claude MCP server only
- `npm run start-with-claude-mcp`: Start both server and application
- `npm run mcp-server`: Start legacy MCP server (backward compatibility)

### Testing

```bash
# Open integration test suite
open test/integration-tests/test-claude-mcp-integration.html
```

The test suite provides:
- Connection testing
- Protocol compliance validation
- All 40+ tools functionality testing
- Performance benchmarking
- Batch testing capabilities

## Tool Execution Examples

### Navigation
```javascript
// Navigate to genomic position
{
  "name": "navigate_to_position",
  "arguments": {
    "chromosome": "chr1",
    "start": 1000,
    "end": 2000
  }
}
```

### Sequence Analysis
```javascript
// Calculate GC content
{
  "name": "compute_gc",
  "arguments": {
    "sequence": "ATGCGCTATCGCGCGCGCGC"
  }
}
```

### Protein Structure
```javascript
// Search protein structure
{
  "name": "fetch_protein_structure",
  "arguments": {
    "geneName": "p53",
    "organism": "Homo sapiens"
  }
}
```

### Database Integration
```javascript
// Search UniProt database
{
  "name": "search_uniprot_database",
  "arguments": {
    "query": "p53",
    "searchType": "gene_name",
    "limit": 5
  }
}
```

### AI-Powered Analysis
```javascript
// Generate DNA sequence with Evo2
{
  "name": "evo2_generate_sequence",
  "arguments": {
    "prompt": "ATGAAA",
    "maxTokens": 100
  }
}
```

## Error Handling

### Standard Error Codes

Following JSON-RPC 2.0 specification:

- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "parameter": "chromosome",
      "reason": "Required parameter missing"
    }
  }
}
```

## Performance Considerations

### Tool Execution Types

1. **Client-Side Tools**: Execute in browser (fast)
   - Navigation tools
   - Basic sequence analysis
   - UI operations

2. **Server-Side Tools**: Execute on server (moderate)
   - Database queries
   - Complex analysis
   - External API calls

3. **AI-Powered Tools**: Execute via external APIs (slow)
   - Evo2 sequence generation
   - Advanced predictions
   - Large-scale analysis

### Optimization Strategies

1. **Request Batching**: Group related tool calls
2. **Caching**: Cache frequent database queries
3. **Parallel Execution**: Execute independent tools concurrently
4. **Progress Reporting**: Provide feedback for long-running operations

## Security Features

### Input Validation

All tool parameters are validated against JSON Schema:

```javascript
{
  "type": "object",
  "properties": {
    "chromosome": { "type": "string" },
    "start": { "type": "number", "minimum": 0 },
    "end": { "type": "number", "minimum": 0 }
  },
  "required": ["chromosome", "start", "end"]
}
```

### Access Control

- Client identification required
- Request rate limiting
- Parameter sanitization
- Error message filtering

## Backward Compatibility

The implementation maintains full backward compatibility:

1. **Legacy WebSocket Servers**: Continue to work unchanged
2. **Existing Client Code**: No modifications required
3. **Configuration**: Automatic migration of settings
4. **Tool Interface**: Identical function signatures

## Future Enhancements

### Planned Features

1. **Streaming Support**: Real-time data streaming
2. **Progress Reporting**: Enhanced progress tracking
3. **Resource Management**: Memory and CPU optimization
4. **Plugin System**: Dynamic tool loading
5. **Authentication**: OAuth and API key support

### Extension Points

1. **Custom Transports**: Add new communication protocols
2. **Tool Plugins**: Dynamic tool registration
3. **Middleware**: Request/response processing
4. **Monitoring**: Performance and usage analytics

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check server is running on correct port
   - Verify WebSocket connectivity
   - Review firewall settings

2. **Tool Not Found**
   - Verify tool name spelling
   - Check server tool registration
   - Review protocol compatibility

3. **Invalid Parameters**
   - Validate parameter types
   - Check required parameters
   - Review parameter constraints

### Debug Mode

Enable debug logging:

```javascript
const server = new ClaudeMCPGenomeServer();
server.debug = true;
```

### Log Analysis

Server logs include:
- Connection events
- Tool execution timing
- Error details
- Performance metrics

## Conclusion

The Claude MCP integration provides a robust, standards-compliant interface for genomics analysis while maintaining backward compatibility and extensibility. The implementation supports all existing functionality through a modern, well-documented protocol that integrates seamlessly with Claude Desktop and other MCP-compliant clients.

The system is designed for scalability, maintainability, and ease of use, providing a solid foundation for future enhancements and integrations in the genomics analysis domain. 