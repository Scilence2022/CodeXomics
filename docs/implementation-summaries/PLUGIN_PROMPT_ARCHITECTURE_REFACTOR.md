# Plugin Prompt Architecture Refactor

## Overview
Successfully refactored the plugin prompt system from hardcoded ChatBox prompts to a dynamic, plugin-driven architecture where plugins provide their own documentation and examples.

## Problem with Previous Architecture

### ❌ Old Approach (Hardcoded):
- **Tight Coupling**: Plugin prompts hardcoded in ChatManager.js
- **Maintenance Burden**: Every plugin change required ChatManager updates
- **No Plugin Autonomy**: Plugins couldn't control their own documentation
- **Synchronization Issues**: Examples could become outdated or inconsistent
- **Poor Scalability**: Adding new plugins required manual prompt updates
- **Separation of Concerns**: Plugin logic separated from its documentation

### Example of Old Hardcoded Approach:
```javascript
// In ChatManager.js - BAD
info += '- Search proteins by gene: {"tool_name": "uniprot-search.searchByGene", ...}\\n';
info += '- Search proteins by name: {"tool_name": "uniprot-search.searchByProtein", ...}\\n';
// Hardcoded examples that could become stale
```

## ✅ New Architecture (Plugin-Driven)

### Design Principles:
1. **Plugin Autonomy**: Each plugin provides its own prompt information
2. **Dynamic Collection**: System automatically collects and organizes plugin prompts
3. **Self-Documentation**: Plugins are responsible for their own examples and usage
4. **Automatic Synchronization**: Prompt updates happen automatically with plugin changes
5. **Separation of Concerns**: Plugin logic and documentation co-located

### Architecture Flow:
```
Plugin.getChatBoxPromptInfo() → 
PluginPromptProvider.registerPluginPrompts() → 
PluginManager.getPluginSystemPromptSection() → 
ChatManager.getPluginSystemInfo() → 
Dynamic System Prompt Generation
```

## Implementation Details

### 1. PluginPromptProvider.js
**New Component**: Central prompt collection and organization system

**Key Features**:
- Plugin prompt registration and validation
- Category-based organization
- Dynamic system prompt generation
- Example collection and formatting
- Statistics and metadata tracking

**Core Methods**:
```javascript
class PluginPromptProvider {
    registerPluginPrompts(pluginId, promptInfo)    // Register plugin prompts
    generateSystemPromptSection()                  // Generate complete prompt section
    getToolCategoriesForPrompt()                  // Get categorized tool lists
    getAllPluginFunctions()                       // Get all function metadata
    getPluginExamples(pluginId)                   // Get plugin-specific examples
}
```

### 2. Enhanced UniProt Plugin
**File**: `src/renderer/modules/Plugins/UniProtSearchPlugin.js`

**New Method**: `getChatBoxPromptInfo()`
- Comprehensive function documentation
- User query examples with natural language mappings
- Organism support information
- Usage guidelines and disambiguation rules

**Example Plugin Prompt Structure**:
```javascript
getChatBoxPromptInfo() {
    return {
        name: 'UniProt Database Search',
        description: 'Comprehensive protein database search...',
        category: 'database-search',
        functions: [
            {
                name: 'searchByGene',
                description: 'Search proteins by gene name...',
                examples: [
                    {
                        description: 'Search lysC gene (NOT PDB)',
                        parameters: { geneName: 'lysC', reviewedOnly: true },
                        userQuery: 'search lysC in UniProt database, NOT pdb'
                    }
                ]
            }
        ],
        organisms: { supported: [...], customSupport: true },
        usage: { commonQueries: [...], disambiguation: {...} }
    };
}
```

### 3. Updated PluginManagerV2.js
**Enhanced Plugin Registration**:
- Automatic prompt collection during plugin registration
- Integration with PluginPromptProvider
- Dynamic prompt section generation methods

**New Methods**:
```javascript
getPluginSystemPromptSection()    // Get complete plugin prompt section
getPluginToolCategories()         // Get plugin tool categories
getAllPluginFunctions()           // Get all plugin functions
```

### 4. Refactored ChatManager.js
**Removed Hardcoded Prompts**:
- Eliminated hardcoded UniProt tool descriptions
- Removed manual plugin example maintenance
- Cleaned up hardcoded tool categories

**Dynamic Integration**:
- `getPluginToolCategories()` - Dynamically includes plugin categories
- `getPluginSystemInfo()` - Uses plugin-provided prompt sections
- Automatic tool category merging with core tools

## Benefits Achieved

### 1. Plugin Autonomy
- ✅ **Self-Documenting**: Plugins control their own documentation
- ✅ **Version Synchronization**: Examples always match current plugin version
- ✅ **Comprehensive Information**: Plugins provide usage, examples, and guidelines
- ✅ **Organism Support**: Plugins specify their own organism capabilities

### 2. Maintainability
- ✅ **Single Source of Truth**: Plugin documentation co-located with implementation
- ✅ **Automatic Updates**: System prompts update automatically with plugin changes
- ✅ **Reduced Coupling**: ChatManager no longer needs plugin-specific knowledge
- ✅ **Easier Plugin Development**: New plugins just need to implement prompt interface

### 3. Scalability
- ✅ **Dynamic Discovery**: New plugins automatically appear in ChatBox prompts
- ✅ **Category Organization**: Automatic categorization and organization
- ✅ **Example Management**: Plugin-provided examples reduce maintenance burden
- ✅ **Flexible Architecture**: Easy to extend with new plugin types

### 4. User Experience
- ✅ **Accurate Documentation**: Always up-to-date plugin information
- ✅ **Better Examples**: Context-aware examples from plugin developers
- ✅ **Comprehensive Coverage**: Plugins provide complete usage information
- ✅ **Intelligent Categorization**: Better organization for LLM understanding

## Generated System Prompt Structure

### Dynamic Plugin Section:
```
PLUGIN SYSTEM TOOLS:
===================

DATABASE-SEARCH:

**UniProt Database Search** (1.0.0):
Comprehensive protein database search using UniProt REST API for gene, protein, and functional analysis

Available Functions:
- searchByGene: Search proteins by gene name (optimized for gene queries)
  Parameters: geneName*, organism, reviewedOnly, maxResults
...

PLUGIN FUNCTION EXAMPLES:
========================

UniProt Database Search:
- Search lysC gene (NOT PDB): {"tool_name": "uniprot-search.searchByGene", "parameters": {"geneName": "lysC", "reviewedOnly": true}}
- Find TP53 in human: {"tool_name": "uniprot-search.searchByGene", "parameters": {"geneName": "TP53", "organism": "human", "reviewedOnly": true}}
...
```

### Tool Categories Integration:
```
CORE TOOL CATEGORIES:
DATABASE SEARCH: uniprot-search.searchByGene, uniprot-search.searchByProtein, uniprot-search.getProteinById, uniprot-search.searchByFunction, uniprot-search.searchUniProt
SEQUENCE ANALYSIS: get_coding_sequence, get_multiple_coding_sequences, get_sequence, translate_dna, reverse_complement, compute_gc
...
```

## User Query Handling

### Natural Language → Function Call Mapping:
Now handled automatically through plugin-provided examples:

```javascript
// Plugin provides this mapping:
{
    userQuery: 'search lysC in UniProt database, NOT pdb',
    expectedCall: {
        tool_name: 'uniprot-search.searchByGene',
        parameters: { geneName: 'lysC', reviewedOnly: true }
    }
}
```

### Enhanced Query Support:
- **Organism Recognition**: "Corynebacterium glutamicum" automatically supported
- **Custom Organisms**: Scientific names handled through plugin configuration
- **Disambiguation**: Clear guidance for UniProt vs. PDB searches
- **Context Awareness**: Plugin-specific usage patterns and best practices

## Testing Infrastructure

### 1. Architecture Validation
**File**: `test/fix-validation-tests/test-plugin-prompt-architecture.html`
- Compares old vs. new architecture approaches
- Validates plugin prompt information collection
- Tests dynamic system prompt generation

### 2. Integration Testing
**File**: `test/integration-tests/test-uniprot-chatbox-integration.html`
- Tests ChatBox function calling with new prompt system
- Validates natural language query interpretation
- Verifies organism support and custom organism functionality

## Migration Benefits

### Before (Hardcoded):
```javascript
// ChatManager.js - Maintenance nightmare
info += 'UNIPROT DATABASE SEARCH TOOLS:\\n';
info += '- Search proteins by gene: {"tool_name": "uniprot-search.searchByGene"...}\\n';
// 20+ lines of hardcoded examples that could become stale
```

### After (Plugin-Driven):
```javascript
// ChatManager.js - Clean and maintainable
getPluginSystemInfo() {
    return this.pluginManager.getPluginSystemPromptSection();
}

// UniProtSearchPlugin.js - Self-documenting
getChatBoxPromptInfo() {
    return {
        // Comprehensive plugin-provided documentation
        // Always in sync with plugin implementation
    };
}
```

## Future Plugin Development

### Plugin Developer Workflow:
1. **Implement Plugin Logic**: Create plugin functionality
2. **Provide Prompt Info**: Implement `getChatBoxPromptInfo()` method
3. **Register Plugin**: Plugin system automatically collects prompts
4. **Automatic Integration**: ChatBox immediately supports new plugin

### Plugin Prompt Interface:
```javascript
class MyPlugin {
    getChatBoxPromptInfo() {
        return {
            name: 'My Plugin',
            description: 'What my plugin does',
            category: 'my-category',
            functions: [
                {
                    name: 'myFunction',
                    description: 'Function description',
                    examples: [
                        {
                            description: 'Example usage',
                            parameters: { param: 'value' },
                            userQuery: 'natural language query'
                        }
                    ]
                }
            ]
        };
    }
}
```

## Verification Results

### ✅ Architecture Successfully Refactored:

1. **Plugin Autonomy**: UniProt plugin now provides its own comprehensive prompt information
2. **Dynamic Collection**: PluginPromptProvider automatically collects and organizes plugin prompts
3. **Clean ChatManager**: Removed all hardcoded plugin-specific prompt information
4. **Automatic Integration**: New plugins will automatically appear in ChatBox prompts
5. **Enhanced Examples**: Plugin-provided examples include natural language mappings
6. **Better Organization**: Category-based organization with automatic merging
7. **Maintainable Code**: Plugin documentation co-located with implementation

### 🎯 User Query Handling:
The query "search lysC in UniProt database, NOT pdb" is now handled through:
1. Plugin-provided example mapping
2. Automatic function call generation
3. Proper parameter extraction
4. Context-aware disambiguation

## Conclusion

The plugin prompt architecture has been successfully refactored from a hardcoded, maintenance-heavy approach to a dynamic, plugin-driven system. This provides:

- **Better Separation of Concerns**: Plugins own their documentation
- **Improved Maintainability**: No more manual synchronization required
- **Enhanced Scalability**: New plugins automatically integrate with ChatBox
- **Superior User Experience**: Always up-to-date, comprehensive plugin information

The new architecture follows software engineering best practices and provides a solid foundation for future plugin development and ChatBox integration.
