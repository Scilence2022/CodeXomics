# Smart Execution System User Guide

## Overview

The Smart Execution System is a feature in CodeXomics designed to optimize the response speed and accuracy of the ChatBox. The system classifies function calls by feature type and optimizes how they run, giving users a faster, smarter interactive experience.

## Function Categories

### 1. Browser Actions — Priority: 1

**Executed immediately, providing instant visual feedback**

Included functions:

- `navigate_to_position` - Navigate to a specified position
- `zoom_to_gene` - Zoom to a gene's location
- `zoom_in` / `zoom_out` - Zoom the view in/out
- `scroll_left` / `scroll_right` - Scroll the view
- `toggle_track` - Show/hide a track
- `get_current_state` - Get the current state
- `bookmark_position` - Bookmark a position

**Characteristics:**

- 🚀 Highest priority, executed immediately
- ✅ Provides instant visual feedback
- 📱 Executed sequentially to keep the UI state consistent

### 2. Data Retrieval — Priority: 2

**Fast execution with parallel-processing support**

Included functions:

- `get_sequence` - Retrieve sequence data
- `get_gene_details` - Retrieve gene details
- `search_features` - Search features
- `find_gene_by_name` - Find a gene by name
- `get_nearby_features` - Get nearby features
- `get_operons` - Get operon information

**Characteristics:**

- 📊 Medium priority, fast response
- ⚡ Supports running multiple queries in parallel
- 🔍 Optimized search and retrieval operations

### 3. Sequence Analysis — Priority: 3

**Computational analysis with smart execution optimization**

Included functions:

- `translate_sequence` - Translate a sequence
- `calculate_gc_content` - Calculate GC content
- `codon_usage_analysis` - Codon usage analysis
- `calculate_melting_temp` - Calculate melting temperature

**Characteristics:**

- 🧬 Analysis tasks that require compute time
- 🔬 Supports parallel computation for efficiency
- 📈 Provides detailed analysis results

### 4. Advanced Analysis — Priority: 4

**Compute-intensive, optimized background processing**

Included functions:

- `find_intergenic_regions` - Find intergenic regions
- `predict_promoter` - Predict promoters
- `predict_terminator` - Predict terminators
- `compare_regions` - Compare regions
- `virtual_digest` - Virtual digestion

**Characteristics:**

- 🔬 Compute-intensive analysis
- ⏱️ Longer execution time, processed in the background
- 🧪 Advanced bioinformatics features

### 5. External Services — Priority: 5

**Network-dependent, asynchronous processing**

Included functions:

- `blast_search` - BLAST search
- `batch_blast_search` - Batch BLAST search
- `advanced_blast_search` - Advanced BLAST search
- `open_protein_viewer` - View protein structures
- `fetch_protein_structure` - Fetch protein structures

**Characteristics:**

- 🌐 Depend on external network services
- ⚡ Executed asynchronously to avoid blocking
- 🔍 Provide rich external data

## How to Use

### 1. Automatic Smart Execution

The system automatically analyzes the user request and intelligently selects the best execution strategy:

```
User: "Navigate to gene lacZ and show its GC content analysis"

System analysis:
✅ Stage 1: Browser action — execute navigate_to_position immediately
✅ Stage 2: Sequence analysis — execute calculate_gc_content in parallel

Result: The user immediately sees the navigation, followed by the GC analysis results
```

### 2. Batch Operation Optimization

When a user requests multiple operations, the system intelligently groups and parallelizes them:

```
User: "Search for genes dnaA, recA, and lacZ, and analyze their upstream regions"

Execution plan:
📊 Data retrieval stage: search 3 genes in parallel
🧬 Sequence analysis stage: analyze upstream regions in parallel
⏱️ Estimated time: 2.5s (vs. 6s for traditional sequential execution)
```

### 3. Visual Feedback System

Different types of operations provide different visual feedback:

- ✅ **Browser actions**: "Browser actions completed (2/2)"
- 📊 **Data retrieval**: "Data retrieved (3/3)"
- 🧬 **Sequence analysis**: "Analysis completed (1/1)"
- 🔍 **BLAST search**: "BLAST search completed (1/1)"

## Performance Benefits

### 1. Faster Response

- **Browser actions**: executed immediately, responding within 100ms
- **Parallel processing**: supported operations run in parallel, 2–5× faster
- **Smart scheduling**: execution order optimized by operation type

### 2. Improved User Experience

- **Instant feedback**: browser operations take effect immediately
- **Progress indication**: real-time display of execution progress and category
- **Error handling**: intelligent failover and error recovery

### 3. Resource Optimization

- **Memory management**: intelligent memory use and cleanup
- **Network optimization**: batched external service calls
- **CPU optimization**: parallel distribution of compute tasks

## Configuration Options

### Enable/Disable Smart Execution

```javascript
// In ChatManager
this.isSmartExecutionEnabled = true; // enabled by default

// Disable smart execution and fall back to traditional mode
chatManager.isSmartExecutionEnabled = false;
```

### View Execution Statistics

```javascript
// Get performance statistics
const stats = chatManager.smartExecutor.getPerformanceStats();
console.log('Average execution time:', stats.averageTime);
console.log('Success rate:', stats.successRate);
console.log('Category performance:', stats.categoryPerformance);
```

### Reset Performance Metrics

```javascript
// Reset all performance metrics
chatManager.smartExecutor.resetMetrics();
```

## Developer Guide

### Adding a New Function Call

1. Add the function name to the appropriate category in `FunctionCallsOrganizer.js`
2. Set an appropriate priority based on the feature's characteristics
3. Consider whether it supports parallel execution

```javascript
// Example: adding a new sequence analysis function
sequenceAnalysis: {
    priority: 3,
    description: "Sequence analysis and computational tools",
    functions: [
        // ... existing functions
        'new_sequence_analysis_function' // newly added function
    ]
}
```

### Custom Execution Strategy

```javascript
// Add custom logic in SmartExecutor
async customExecutionStrategy(toolRequests, strategy) {
    // custom execution logic
    return results;
}
```

## Best Practices

### 1. Optimizing User Requests

- **Clarity**: clearly state the operations and data you need
- **Layering**: break complex requests into logical layers
- **Batching**: request multiple related operations at once

### 2. Performance Optimization

- **Cache usage**: repeated data is cached automatically
- **Batch operations**: similar operations are batched automatically
- **Error recovery**: the system automatically handles partial failures

### 3. Debugging and Monitoring

- **Console logs**: review detailed execution logs
- **Performance metrics**: monitor execution performance per category
- **Error tracking**: detect and resolve issues promptly

## Troubleshooting

### 1. Smart Execution Fails

```
Symptom: falls back to traditional execution mode
Solution: check module loading and network connectivity
```

### 2. Performance Degradation

```
Symptom: execution takes longer than expected
Solution: review the performance statistics and optimize how requests are phrased
```

### 3. Some Features Stop Working

```
Symptom: certain function calls do not work
Solution: check the feature category and parameter settings
```

## Technical Architecture

```
User request
    ↓
ChatManager (parsing and routing)
    ↓
SmartExecutor (smart scheduling)
    ↓
FunctionCallsOrganizer (classification and optimization)
    ↓
Parallel/sequential execution → Visual feedback → Result aggregation
```

## Changelog

### v1.0.0 (current version)

- ✅ Core function classification system
- ✅ Smart execution scheduler
- ✅ Parallel processing support
- ✅ Visual feedback system
- ✅ Performance monitoring and statistics

### Planned Features

- 🔄 Adaptive priority adjustment
- 📊 More detailed performance analysis
- 🤖 Machine-learning-optimized execution strategies
- 🔧 Visual configuration interface

## Support

If you run into problems using the Smart Execution System, please:

1. Check the log messages in the browser console
2. Verify that the relevant modules loaded correctly
3. Review the performance statistics
4. See the Troubleshooting section

The Smart Execution System makes interacting with CodeXomics faster, smarter, and more user-friendly!
