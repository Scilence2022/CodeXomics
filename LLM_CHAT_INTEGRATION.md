# LLM Chat Integration for Genome AI Studio

## Overview

Genome AI Studio includes a comprehensive LLM (Large Language Model) chat interface that enables natural language interaction with genomic data. The AI assistant has been recently enhanced with **corrected function calling** that properly distinguishes between text-based searches and position-based searches, providing more accurate and reliable responses.

## 🆕 Recent Improvements

### **Fixed Search Function Calling**
- **Corrected LLM behavior**: AI now properly uses `search_features` for text-based searches like "find DNA polymerase"
- **Clear function distinction**: Separated text search (`search_features`) from position-based search (`get_nearby_features`)
- **Enhanced system prompts**: Better guidance with explicit examples and rules
- **Improved reliability**: More consistent and accurate function selection

### **Enhanced AI Capabilities**
- **Smarter function selection**: AI correctly interprets search intentions
- **Better examples**: More explicit function call examples in system prompts
- **Improved accuracy**: Reduced confusion between different search types
- **Real-time learning**: AI adapts to user patterns and preferences

## Features

### 🤖 **Multi-Provider LLM Support**
- **OpenAI**: GPT-4o, GPT-4o Mini, GPT-4, GPT-3.5 Turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- **Google**: Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 1.0 Pro
- **Local LLMs**: Ollama, LMStudio, or any OpenAI-compatible API

### ⚙️ **LLM Configuration**
Access via **Options → Configure LLMs** in the header menu:

#### OpenAI Configuration
- **API Key**: From [OpenAI Platform](https://platform.openai.com/api-keys)
- **Model Selection**: GPT-4o (recommended), GPT-4o Mini, GPT-4, GPT-3.5 Turbo
- **Custom Base URL**: For API proxy or custom endpoints
- **Test Connection**: Verify credentials before saving

#### Anthropic Configuration  
- **API Key**: From [Anthropic Console](https://console.anthropic.com/)
- **Model Selection**: Claude 3.5 Sonnet (recommended), Claude 3 Opus, Claude 3 Haiku
- **Custom Base URL**: For API proxy or custom endpoints
- **Advanced Features**: Support for system prompts and tool usage

#### Google Configuration
- **API Key**: From [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Model Selection**: Gemini 2.0 Flash (recommended), Gemini 1.5 Pro, Gemini 1.5 Flash
- **Base URL**: Default `https://generativelanguage.googleapis.com` (v1beta for Gemini models)
- **Streaming Support**: Real-time response streaming

#### DeepSeek Configuration
- **API Key**: From [DeepSeek Platform](https://platform.deepseek.com/)
- **Model Selection**: DeepSeek Chat (recommended), DeepSeek Coder, DeepSeek Reasoner
- **Base URL**: Default `https://api.deepseek.com/v1`
- **Advanced Features**: Support for reasoning capabilities and specialized coding assistance

#### Local LLM Configuration
- **API Endpoint**: e.g., `http://localhost:11434/v1` (Ollama), `http://localhost:1234/v1` (LMStudio)
- **Model Name**: e.g., `llama3.2`, `codellama`, `mistral`, `qwen2.5`
- **Optional API Key**: If required by your local setup
- **Streaming Support**: Enable for real-time responses
- **Custom Parameters**: Temperature, max tokens, and other model parameters

### 🔧 **Configuration Management**
- **Test Connection**: Verify API credentials and connectivity with live requests
- **Auto-Save**: Configurations stored securely using ConfigManager
- **Provider Switching**: Easy switching between configured providers
- **Visual Status**: Real-time connection status indicators
- **Error Handling**: Clear error messages for configuration issues

### 💬 **Enhanced Chat Interface**
- **Floating Panel**: Modern, resizable chat interface with drag-and-drop positioning
- **Natural Language**: Conversational interaction with genomic data
- **Corrected Tool Integration**: Reliable access to studio functionality
- **Context Awareness**: LLM understands current studio state and loaded data
- **Message History**: Persistent conversation history with export capabilities
- **Suggestions**: Built-in example queries and commands
- **Typing Indicators**: Visual feedback during AI processing
- **Copy Functionality**: Easy copying of responses and code snippets

## Function Calling System

### **🔧 Fixed Search Functions**

The AI assistant now correctly distinguishes between two types of searches:

#### 1. **Text-Based Search** (`search_features`)
**Use for**: Gene names, products, descriptions, annotations

**Examples that now work correctly**:
```
"Find DNA polymerase"                    → search_features
"Search for lacZ gene"                   → search_features  
"Show me ribosomal proteins"             → search_features
"Find genes with 'kinase' in the name"  → search_features
```

**What it does**: 
- Searches annotation text fields (gene names, products, descriptions)
- Displays results in the left sidebar search panel
- Provides one-click navigation to matches

#### 2. **Position-Based Search** (`get_nearby_features`)
**Use for**: Finding features near specific genomic coordinates

**Examples**:
```
"What's near position 12345?"            → get_nearby_features
"Find genes around coordinate 50000"     → get_nearby_features
"Show features within 5kb of position X" → get_nearby_features
```

**What it does**:
- Finds features within a specified distance of a position
- Returns spatial proximity information
- Useful for understanding genomic neighborhood

### **Available Tools**

#### Core Navigation & Search
- **`navigate_to_position`** - Jump to specific genomic coordinates
- **`search_features`** - 🆕 **FIXED** Text-based search for genes/annotations
- **`get_nearby_features`** - Position-based proximity search
- **`get_current_state`** - Retrieve current studio state and context

#### Data Retrieval & Analysis
- **`get_sequence`** - Extract DNA sequences from regions
- **`analyze_region`** - Comprehensive genomic region analysis
- **`sequence_statistics`** - Calculate composition, GC content, complexity
- **`codon_usage_analysis`** - Analyze codon usage patterns

#### Visualization Control
- **`toggle_track`** - Show/hide visualization tracks
- **`zoom_to_gene`** - Focus view on specific genes
- **`bookmark_position`** - Save interesting positions
- **`save_view_state`** - Save current view configuration

#### Annotation & Export
- **`create_annotation`** - Create custom genomic annotations
- **`edit_annotation`** - Modify existing annotations  
- **`export_data`** - Export sequences and annotations
- **`export_region_features`** - Export features from specific regions

#### Advanced Analysis
- **`search_motif`** - Find DNA motifs and patterns
- **`find_restriction_sites`** - Locate restriction enzyme sites
- **`virtual_digest`** - Simulate restriction digests
- **`compare_regions`** - Compare different genomic regions
- **`find_similar_sequences`** - Identify sequence similarities

## Natural Language Examples

### **✅ Text-Based Searches (Fixed)**
These now correctly use `search_features`:
```
"Find DNA polymerase genes"              ✅ Searches annotations
"Search for lacZ"                        ✅ Finds lacZ gene
"Show me ribosomal proteins"             ✅ Searches products  
"Find genes containing 'kinase'"         ✅ Text search
"Look for tRNA genes"                    ✅ Feature type search
```

### **✅ Position-Based Searches**
These correctly use `get_nearby_features`:
```
"What's near position 12345?"            ✅ Proximity search
"Find genes around coordinate 50000"     ✅ Spatial search
"Show features within 5kb of position X" ✅ Distance search
```

### **Navigation Commands**
```
"Navigate to chromosome 1 position 1000-2000"
"Go to chr1:1000-2000"
"Show me the region around position 5000"
"Jump to the start of chromosome 2"
```

### **Analysis & Visualization**
```
"What's the GC content of this region?"
"Show variant data"
"Hide the protein track"
"Calculate sequence statistics for chr1:1000-5000"
"Find EcoRI restriction sites"
```

### **Data Export & Management**
```
"Export this region as FASTA"
"Save current view state"
"Bookmark this interesting region"
"Create a gene annotation from 1000 to 2000"
```

## Setup Instructions

### 1. **Configure LLM Provider**
1. Click **Options** in the header menu
2. Select **Configure LLMs**
3. Choose your preferred provider tab
4. Enter API credentials and select model
5. **Test connection** to verify setup
6. Save configuration

### 2. **Start Enhanced Chat**
1. Click the robot icon 🤖 in the toolbar
2. Chat panel appears with improved interface
3. Try corrected search commands like "find DNA polymerase"
4. Experience more reliable function calling

### 3. **Advanced Integration** (Optional)
```bash
# Start with MCP server for advanced features
npm run start-with-mcp

# Or start separately
npm run mcp-server
npm start
```

## System Prompt Improvements

### **Enhanced Function Selection Rules**
The AI now has explicit rules for choosing the correct function:

```
CRITICAL FUNCTION SELECTION RULES:
- For ANY text-based search (gene names, products, descriptions): ALWAYS use 'search_features'
  Examples: "find DNA polymerase", "search for lacZ", "show ribosomal genes" → use search_features
- For position-based searches: ONLY use 'get_nearby_features' 
  Examples: "what's near position 12345", "features around coordinate 50000" → use get_nearby_features
```

### **Improved Examples**
More explicit function call examples with clear distinctions:

```javascript
// Text-based search (CORRECT)
{"tool_name": "search_features", "parameters": {"query": "DNA polymerase", "caseSensitive": false}}

// Position-based search (CORRECT)  
{"tool_name": "get_nearby_features", "parameters": {"position": 12345, "distance": 5000}}
```

## Troubleshooting

### **Search Issues**
- **Problem**: AI uses wrong search function
- **Solution**: Use explicit language like "search for gene name X" vs "find features near position Y"

### **Configuration Issues**
- **API Key Errors**: Verify key validity and permissions
- **Connection Failures**: Check network connectivity and endpoint URLs
- **Model Access**: Ensure selected model is available for your API tier

### **Performance Issues**
- **Slow Responses**: Try different models or providers
- **Large Datasets**: Use specific regions rather than whole genome queries
- **Memory Usage**: Close unnecessary browser tabs during analysis

## Best Practices

### **Effective Prompting**
- **Be specific**: "Find lacZ gene" vs "search for something"
- **Use correct terminology**: "DNA polymerase" vs "polymerase enzyme"
- **Specify regions**: "chr1:1000-2000" for targeted analysis

### **Function Usage**
- **Text searches**: Use for finding genes by name/description
- **Position searches**: Use for exploring genomic neighborhoods  
- **Analysis**: Combine multiple functions for comprehensive exploration

### **Data Management**
- **Export results**: Save interesting findings for later analysis
- **Bookmark positions**: Mark important genomic locations
- **Save view states**: Preserve useful display configurations

## API Reference

### **Function Call Format**
```javascript
{
  "tool_name": "function_name",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

### **Response Handling**
- **Tool Results**: Structured data returned from function calls
- **Error Handling**: Clear error messages for invalid requests
- **Context Updates**: Automatic browser state synchronization

## Future Enhancements

### **Planned Improvements**
- **Voice interaction**: Speech-to-text and text-to-speech
- **Advanced visualization**: AI-generated custom plots and charts
- **Automated analysis**: Pre-configured analysis pipelines
- **Collaborative features**: Shared sessions and annotations

### **Integration Roadmap**
- **Database connectivity**: Direct access to genomic databases
- **Cloud analysis**: Integration with cloud-based analysis tools
- **Version control**: Track changes and analysis history
- **API extensions**: Custom tool development framework

## MCP (Model Context Protocol) Integration

### Available Tools

The LLM has access to these studio tools:

#### 1. **navigate_to_position**
Navigate to specific genomic coordinates
```javascript
{
  "chromosome": "chr1",
  "start": 1000,
  "end": 2000
}
```

#### 2. **search_features**
Search for genes or features by name or sequence
```javascript
{
  "query": "recA",
  "caseSensitive": false
}
```

#### 3. **get_current_state**
Retrieve current studio state and context
```javascript
{
  // Returns current chromosome, position, tracks, files, etc.
}
```

#### 4. **get_sequence**
Extract DNA sequence from specific regions
```javascript
{
  "chromosome": "chr1",
  "start": 1000,
  "end": 2000
}
```

#### 5. **toggle_track**
Show or hide visualization tracks
```javascript
{
  "trackName": "genes", // genes, gc, variants, reads, proteins
  "visible": true
}
```

#### 6. **create_annotation**
Create custom genomic annotations
```javascript
{
  "type": "gene",
  "name": "newGene1",
  "chromosome": "chr1",
  "start": 1000,
  "end": 2000,
  "strand": 1,
  "description": "Custom annotation"
}
```

#### 7. **analyze_region**
Comprehensive analysis of genomic regions
```javascript
{
  "chromosome": "chr1",
  "start": 1000,
  "end": 2000,
  "includeFeatures": true,
  "includeGC": true
}
```

#### 8. **export_data**
Export sequence or annotation data
```javascript
{
  "format": "fasta", // fasta, genbank, gff, bed
  "chromosome": "chr1",
  "start": 1000,
  "end": 2000
}
```

## Natural Language Examples

### Navigation Commands
- "Navigate to chromosome 1 position 1000 to 2000"
- "Go to chr1:1000-2000"
- "Show me the region around position 5000"
- "Jump to the start of chromosome 2"

### Search and Analysis
- "Find gene recA"
- "Search for all tRNA genes"
- "What genes are in the current view?"
- "Show me the GC content of this region"
- "What's the sequence from 1000 to 1500?"

### Track Management
- "Hide the GC content track"
- "Show variant data"
- "Toggle the protein track"
- "Display all tracks"

### Data Analysis
- "Analyze the region chr1:1000-5000"
- "What features are between positions 2000 and 3000?"
- "Calculate GC content for the current view"
- "Export this region as FASTA"

### Feature Creation
- "Create a gene annotation from 1000 to 2000 called newGene"
- "Add a CDS feature at position 1500-1800"
- "Mark this region as a promoter"

## Technical Architecture

### Components

1. **LLMConfigManager** (`src/renderer/modules/LLMConfigManager.js`)
   - Manages multiple LLM provider configurations
   - Handles API communication and authentication
   - Provides connection testing and status management

2. **ChatManager** (`src/renderer/modules/ChatManager.js`)
   - Frontend chat interface and WebSocket client
   - Integrates with LLMConfigManager for AI communication
   - Manages chat UI, message history, and tool execution

3. **MCP Server** (`src/mcp-server.js`)
   - WebSocket server (port 3001) for real-time communication
   - HTTP API (port 3000) for LLM service integration
   - Tool execution and studio state management

### Configuration Storage

Configurations are stored securely in browser localStorage:
```javascript
{
  "providers": {
    "openai": {
      "name": "OpenAI",
      "apiKey": "sk-...",
      "model": "gpt-4o",
      "baseUrl": "https://api.openai.com/v1",
      "enabled": true
    },
    // ... other providers
  },
  "currentProvider": "openai"
}
```

### Security Features

- **Secure Storage**: API keys stored in browser localStorage (client-side only)
- **Input Validation**: All API requests validated and sanitized
- **Error Handling**: Graceful error handling with user-friendly messages
- **Connection Testing**: Verify credentials before saving
- **No Server Storage**: No API keys stored on server side

## Troubleshooting

### Common Issues

#### "LLM not configured" message
- Go to Options → Configure LLMs
- Enter valid API credentials for your chosen provider
- Test the connection before saving

#### Connection failures
- Check API key validity
- Verify internet connection
- Check provider service status
- Try switching to a different provider

#### Local LLM not responding
- Ensure local LLM server is running (e.g., Ollama)
- Check endpoint URL (typically `http://localhost:11434/v1`)
- Verify model name matches installed models
- Check if API key is required for your setup

#### MCP server connection issues
- Ensure MCP server is running (`npm run mcp-server`)
- Check WebSocket connection on port 3001
- Verify no firewall blocking local connections

### Debug Information

Enable developer console to see:
- LLM API request/response logs
- MCP WebSocket connection status
- Tool execution results
- Error details and stack traces

## API Reference

### LLMConfigManager Methods

```javascript
// Check if LLM is configured
llmConfigManager.isConfigured()

// Send message to LLM
await llmConfigManager.sendMessage(message, context)

// Test provider connection
await llmConfigManager.testConnection()

// Get current configuration
llmConfigManager.getConfiguration()
```

### ChatManager Methods

```javascript
// Send message through chat interface
chatManager.sendMessage()

// Execute studio tool
await chatManager.executeToolRequest(toolData)

// Update studio state
chatManager.sendStateUpdate(state)
```

## Best Practices

### For Users
1. **Start Simple**: Begin with basic navigation and search queries
2. **Be Specific**: Include chromosome names and position ranges when relevant
3. **Use Context**: Reference "current view" or "this region" for context-aware queries
4. **Explore Tools**: Try different types of analysis and export options

### For Developers
1. **Error Handling**: Always wrap LLM calls in try-catch blocks
2. **Context Building**: Provide relevant studio state to LLM
3. **Tool Validation**: Validate tool parameters before execution
4. **User Feedback**: Show loading states and error messages clearly

### Security Considerations
1. **API Key Management**: Never log or expose API keys in client code
2. **Input Sanitization**: Validate all user inputs before sending to LLM
3. **Rate Limiting**: Implement client-side rate limiting for API calls
4. **Error Messages**: Don't expose sensitive information in error messages

## Future Enhancements

### Planned Features
- **Streaming Responses**: Real-time streaming for supported providers
- **Voice Integration**: Voice-to-text input for hands-free interaction
- **Custom Tools**: User-defined tools and workflows
- **Collaboration**: Shared chat sessions and annotations
- **Advanced Analytics**: ML-powered genomic analysis suggestions

### Integration Opportunities
- **Cloud Storage**: Integration with cloud genomics platforms
- **Database Connectivity**: Direct querying of genomic databases
- **Workflow Automation**: Automated analysis pipelines
- **Visualization Extensions**: AI-generated custom visualizations

## Support

For technical support or feature requests:
- Check the troubleshooting section above
- Review console logs for error details
- Ensure your LLM provider credentials are valid
- Verify MCP server is running for advanced features

The LLM chat integration transforms the Genome Studio into an intelligent, conversational tool that makes genomic analysis more accessible and intuitive for researchers at all levels.

### 🛠️ **MCP Tool API**

The MCP server exposes an HTTP API for LLM services to interact with the Genome Studio. This API is designed to be simple and robust, allowing LLMs to perform actions within the studio.

**Base URL:** `http://localhost:3000`

#### Health Check
- **Endpoint:** `/health`
- **Method:** `GET`
- **Description:** Checks the status of the MCP server.
- **Success Response (200 OK):**
  ```json
  {
    "status": "ok",
    "message": "MCP Server is running",
    "timestamp": "2024-05-30T12:00:00.000Z"
  }
  ```

#### Get Available Tools
- **Endpoint:** `/tools`
- **Method:** `GET`
- **Description:** Retrieves a list of available tools that the LLM can use.
- **Success Response (200 OK):**
  ```json
  {
    "tools": [
      {
        "name": "navigate_to_position",
        "description": "Navigates the studio to a specific genomic position (e.g., chr1:1000-2000).",
        "parameters": [
          {"name": "chromosome", "type": "string", "description": "Chromosome name (e.g., chr1)", "required": true},
          {"name": "start", "type": "integer", "description": "Start position", "required": true},
          {"name": "end", "type": "integer", "description": "End position", "required": true}
        ]
      }
      // ... other tools
    ]
  }
  ```

#### Execute Tool
- **Endpoint:** `/execute_tool`
- **Method:** `POST`
- **Description:** Executes a specified tool with the given parameters.
- **Request Body:**
  ```json
  {
    "tool_name": "navigate_to_position",
    "client_id": "unique-client-id-from-websocket", // Provided when client connects
    "parameters": {
      "chromosome": "chr1",
      "start": 1000,
      "end": 2000
    }
  }
  ```
- **Success Response (200 OK):** Varies based on the tool. Usually a confirmation or requested data.
  ```json
  // Example for navigate_to_position
  {
    "status": "success",
    "message": "Navigated to chr1:1000-2000"
  }
  ```
- **Error Response (e.g., 400 Bad Request, 500 Internal Server Error):**
  ```json
  {
    "status": "error",
    "message": "Error executing tool: Invalid parameters"
  }
  ```

### WebSocket Communication (Browser ↔ MCP Server)

The browser frontend communicates with the MCP server via WebSocket (`ws://localhost:3001`).

**Key Messages:**
- **Client → Server:**
  - `register_client`: Sent on connection to get a unique `client_id`.
  - `tool_response`: Sent from browser to MCP server after a tool execution completes (or fails) in the browser.
    ```json
    {
      "type": "tool_response",
      "request_id": "unique-request-id-from-llm",
      "tool_name": "navigate_to_position",
      "status": "success", // or "error"
      "result": { "message": "Navigation complete" }, // or { "error": "Details..." }
      "client_id": "unique-client-id"
    }
    ```
- **Server → Client:**
  - `assign_client_id`: Provides the `client_id` to the browser.
  - `execute_tool`: Instructs the browser to execute a tool (originating from an LLM API call).
    ```json
    {
      "type": "execute_tool",
      "request_id": "unique-request-id-for-llm-response",
      "tool_name": "navigate_to_position",
      "parameters": { "chromosome": "chrX", "start": 100, "end": 200 }
    }
    ```
  - `mcp_error`: Sent if there's an error on the MCP server unrelated to a specific tool.

### UI Implementation

The chat interface (`ChatManager.js`) handles:
- WebSocket connection to MCP server.
- Sending user messages to the configured LLM (via MCP server or directly if configured).
- Receiving tool execution requests from the MCP server.
- Calling appropriate `GenomeStudio` methods to execute tools.
- Sending results back to the MCP server.
- Displaying chat history, typing indicators, and connection status.

## Example LLM Interaction Flow (OpenAI via MCP HTTP API)

1.  **User types a message** in the Genome Studio chat: "Navigate to chrM start 100 end 500"
2.  **`ChatManager`** sends this to `LLMConfigManager`.
3.  **`LLMConfigManager`** (if OpenAI is configured) prepares a request for the OpenAI API, including the user message and potentially a system prompt with available tools (obtained from `http://localhost:3000/tools`).
4.  **OpenAI API** responds. If it decides to use a tool, the response might look like:
    ```json
    {
      "choices": [
        {
          "message": {
            "role": "assistant",
            "tool_calls": [
              {
                "id": "call_abc123",
                "type": "function",
                "function": {
                  "name": "navigate_to_position",
                  "arguments": "{\"chromosome\": \"chrM\", \"start\": 100, \"end\": 500}"
                }
              }
            ]
          }
        }
      ]
    }
    ```
5.  **`LLMConfigManager`** parses this. It sees a `tool_calls` directive.
6.  It makes a `POST` request to the **MCP Server API**: `http://localhost:3000/execute_tool`
    ```json
    {
      "tool_name": "navigate_to_position",
      "client_id": "browser-client-id-established-via-websocket",
      "parameters": {"chromosome": "chrM", "start": 100, "end": 500}
    }
    ```
7.  **MCP Server** receives this. It finds the WebSocket connection for `client_id`.
8.  **MCP Server** sends an `execute_tool` message over WebSocket to the **Genome Studio**:
    ```json
    {
      "type": "execute_tool",
      "request_id": "mcp-request-789", // MCP generates a new ID for this leg
      "tool_name": "navigate_to_position",
      "parameters": { "chromosome": "chrM", "start": 100, "end": 500 }
    }
    ```
9.  **`ChatManager`** in the Genome Studio receives this WebSocket message.
10. It calls the corresponding method in `GenomeStudio` (e.g., `genomeStudio.navigationManager.navigateTo(...)`).
11. Once the action is complete, **`ChatManager`** sends a `tool_response` back to the **MCP Server** via WebSocket:
    ```json
    {
      "type": "tool_response",
      "request_id": "mcp-request-789",
      "tool_name": "navigate_to_position",
      "status": "success",
      "result": { "message": "Navigated to chrM:100-500" },
      "client_id": "browser-client-id"
    }
    ```
12. **MCP Server** receives this WebSocket message. It matches `request_id` and sends an HTTP response back to the waiting `LLMConfigManager` (from step 6).
    ```json
    // HTTP Response from MCP Server to LLMConfigManager
    {
      "status": "success",
      "message": "Tool navigate_to_position executed successfully.",
      "tool_result": { "message": "Navigated to chrM:100-500" }
    }
    ```
13. **`LLMConfigManager`** receives this. It now needs to send this tool result back to OpenAI to get a final natural language response.
14. It makes another call to OpenAI, including the original user message, the assistant's first `tool_calls` message, and now a new message with `role: "tool"`:
    ```json
    // Request to OpenAI API
    {
      "model": "gpt-4o",
      "messages": [
        {"role": "user", "content": "Navigate to chrM start 100 end 500"},
        {"role": "assistant", "tool_calls": [ /* as above */ ]},
        {
          "tool_call_id": "call_abc123", 
          "role": "tool", 
          "name": "navigate_to_position", 
          "content": "{\"message\": \"Navigated to chrM:100-500\"}" // Tool execution result
        }
      ]
    }
    ```
15. **OpenAI API** processes this and generates a final user-facing message, e.g.:
    ```json
    {
      "choices": [
        {
          "message": {
            "role": "assistant",
            "content": "Okay, I have navigated to chrM from position 100 to 500 for you."
          }
        }
      ]
    }
    ```
16. **`LLMConfigManager`** returns this content to `ChatManager`.
17. **`ChatManager`** displays the assistant's message in the UI.

This flow allows the LLM to control the studio through a standardized set of tools, mediated by the MCP server. 