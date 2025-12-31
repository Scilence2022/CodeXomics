# Dynamic Tool Registry System Guide

## 📋 Overview

The Dynamic Tool Registry is an intelligent system that automatically selects and injects relevant tools into the LLM's system prompt based on user intent and context. This replaces the traditional monolithic system prompt with a dynamic, scalable, and context-aware approach.

## 🏗️ Architecture

### Core Components

```
tools_registry/
├── registry_manager.js           # Core registry management
├── system_integration.js         # System integration layer
├── tool_categories.yaml          # Tool categorization metadata
└── [category_dirs]/              # Tool definition directories
    ├── navigation/               # Navigation tools (8 tools)
    ├── sequence/                 # Sequence analysis tools (8 tools)
    ├── data_management/          # Data management tools (4 tools)
    ├── protein/                  # Protein analysis tools (6 tools)
    ├── database/                 # Database integration tools (6 tools)
    ├── ai_analysis/              # AI analysis tools (5 tools)
    ├── pathway/                  # Pathway analysis tools (2 tools)
    ├── sequence_editing/         # Sequence editing tools (10 tools)
    ├── plugin_management/        # Plugin management tools (12 tools)
    ├── coordination/             # Multi-agent coordination (15 tools)
    └── external_apis/            # External API tools (12 tools)
```

## 🔄 Workflow

### 1. **Initialization**
- Load tool categories metadata from `tool_categories.yaml`
- Initialize caching system with 5-minute timeout
- Preload critical tools for performance

### 2. **User Query Processing**
```
User Query → Intent Analysis → Tool Selection → Scoring → System Prompt Generation
```

### 3. **Tool Selection Algorithm**
1. **Intent Analysis**: Analyze user query for keywords and intent
2. **Category Filtering**: Select relevant tool categories
3. **Tool Matching**: Match tools based on keywords and context
4. **Scoring**: Score tools based on relevance and priority
5. **Selection**: Return top 10 most relevant tools

### 4. **Performance Optimization**
- **Caching**: 5-minute cache for tool definitions
- **Lazy Loading**: Load tools only when needed
- **Early Termination**: Stop processing for simple tasks
- **Context Awareness**: Consider current genome state

## 📝 Tool Definition Schema

### YAML Structure
```yaml
name: "tool_name"
description: "Tool description"
category: "category_name"
priority: 1
keywords: ["keyword1", "keyword2"]
parameters:
  param1:
    type: "string"
    required: true
    description: "Parameter description"
returns:
  result: "Return value description"
sample_usage: "Example usage"
error_handling:
  error_type: "Error description"
```

### Example: codon_usage_analysis.yaml
```yaml
name: "codon_usage_analysis"
description: "Analyze codon usage patterns in DNA coding sequence"
category: "data_management"
priority: 2
keywords: ["codon", "usage", "analysis", "gene", "locus", "lacZ"]
parameters:
  sequence:
    type: "string"
    required: false
    description: "DNA sequence to analyze"
  geneName:
    type: "string"
    required: false
    description: "Gene name to analyze"
  locusTag:
    type: "string"
    required: false
    description: "Locus tag to analyze"
returns:
  result: "Detailed codon usage analysis results"
```

## ⚙️ Configuration

### ChatBox Settings
The Dynamic Tool Registry can be enabled/disabled through ChatBox Settings:

1. Open ChatBox Settings
2. Navigate to "Advanced > System Prompt"
3. Toggle "Enable Dynamic Tools Registry"
4. Default: Enabled

### Fallback Behavior
When disabled, the system falls back to the traditional monolithic system prompt approach.

## 🎯 Tool Selection Examples

### Query: "codon usage analysis of lacZ gene"
**Selected Tools:**
- `codon_usage_analysis` (primary match)
- `search_gene_by_name` (gene search)
- `get_sequence` (sequence retrieval)

### Query: "Find all ribosomal genes"
**Selected Tools:**
- `search_gene_by_name` (gene search)
- `search_features` (feature search)
- `analyze_region` (region analysis)

### Query: "Calculate GC content"
**Selected Tools:**
- `compute_gc` (GC analysis)
- `get_sequence` (sequence retrieval)
- `analyze_region` (region analysis)

## 🔧 Integration Points

### ChatManager Integration
```javascript
// Initialize Dynamic Tools Registry
await this.initializeDynamicTools();

// Generate dynamic system prompt
const systemPrompt = await this.buildSystemMessage();

// Process tool results
const response = await this.generateCompletionResponseFromToolResults(results);
```

### Settings Integration
```javascript
// Check if Dynamic Tools Registry is enabled
if (this.chatboxSettings.enableDynamicToolsRegistry) {
    // Use Dynamic Tool Registry
} else {
    // Use traditional system prompt
}
```

## 📊 Performance Metrics

### Current System Status
- **Total Tools**: 88 tools across 11 categories
- **Cache Hit Rate**: High (5-minute cache timeout)
- **Tool Selection Time**: <100ms average
- **Context Size Reduction**: 60-80% compared to monolithic approach

### Optimization Features
- **Intelligent Caching**: Reduces file I/O operations
- **Lazy Loading**: Loads only relevant tools
- **Early Termination**: Stops processing for simple tasks
- **Context Awareness**: Considers current genome state

## 🐛 Troubleshooting

### Common Issues

**1. No tools selected (0 dynamically selected tools)**
- Check if Dynamic Tools Registry is enabled in settings
- Verify tool categories are loaded correctly
- Check for YAML syntax errors in tool definitions

**2. Wrong tools selected**
- Review tool keywords and descriptions
- Check intent analysis logic
- Verify tool scoring algorithm

**3. Tool execution failures**
- Check tool parameter validation
- Verify tool implementation in ChatManager
- Review error handling in tool definitions

### Debug Information
Enable debug logging to see:
- Tool selection process
- Intent analysis results
- Tool scoring details
- Cache hit/miss statistics

## 🚀 Future Enhancements

### Planned Features
- **Machine Learning**: Learn from user interactions to improve tool selection
- **Tool Relationships**: Better understanding of tool dependencies
- **Performance Analytics**: Detailed performance metrics and optimization
- **Custom Tool Categories**: User-defined tool categories
- **Tool Versioning**: Support for tool version management

### Long-term Vision
- **Predictive Tool Selection**: Anticipate user needs
- **Contextual Learning**: Adapt to user workflows
- **Tool Recommendation**: Suggest relevant tools
- **Performance Optimization**: Continuous performance improvements

## 📚 Related Documentation

- [PROJECT_RULES.md](../PROJECT_RULES.md) - Project development rules
- [README.md](../README.md) - Main project documentation
- [ChatManager.js](../../src/renderer/modules/ChatManager.js) - Implementation details
- [Tool Categories](../../tools_registry/tool_categories.yaml) - Tool categorization

---

*This guide is part of the CodeXomics documentation. For questions or contributions, please refer to the main project repository.*
