# MicrobeGenomicsFunctions LLM Integration

## Overview

The **MicrobeGenomicsFunctions.js** module provides atomic, composable functions for microbial genomics analysis that can be used by LLMs through the **ChatManager.js** interface. This integration allows AI assistants to perform complex genomic analyses by chaining simple function calls.

## Architecture

```
User Chat Input → ChatManager → LLM → Tool Calls → MicrobeGenomicsFunctions → Results → User
```

### Key Components:

1. **MicrobeGenomicsFunctions.js**: Contains 30+ basic genomic functions
2. **ChatManager.js**: Handles LLM communication and tool execution
3. **LLM Integration**: System prompts guide the AI to use appropriate functions

## Available Function Categories

### 🧭 Navigation Functions
- `navigate_to`: Navigate to specific genomic coordinates
- `jump_to_gene`: Jump directly to a gene location
- `get_current_region`: Get current viewing region
- `scroll_left/scroll_right`: Move view left/right
- `zoom_in/zoom_out`: Change zoom level

### 🔬 Analysis Functions
- `compute_gc`: Calculate GC content of DNA sequence
- `reverse_complement`: Get reverse complement of DNA
- `translate_dna`: Translate DNA to protein sequence
- `find_orfs`: Find Open Reading Frames
- `calculate_entropy`: Calculate sequence complexity

### 📊 Calculation Functions
- `calc_region_gc`: Calculate GC% for genomic region
- `calculate_melting_temp`: DNA melting temperature
- `calculate_molecular_weight`: Molecular weight of DNA
- `analyze_codon_usage`: Codon usage statistics

### 🔮 Prediction Functions
- `predict_promoter`: Find promoter motifs (-10 box)
- `predict_rbs`: Predict ribosome binding sites
- `predict_terminator`: Find transcription terminators

### 🔍 Search Functions
- `search_gene_by_name`: Find genes by name/locus tag
- `search_sequence_motif`: Search for DNA motifs
- `search_by_position`: Find features at position
- `search_intergenic_regions`: Find gaps between genes

### ✏️ Editing Functions
- `edit_annotation`: Modify existing annotations
- `delete_annotation`: Remove annotations
- `merge_annotations`: Combine overlapping annotations

### ➕ Addition Functions
- `add_annotation`: Add new feature annotations
- `get_upstream_region`: Get sequence upstream of gene
- `get_downstream_region`: Get sequence downstream of gene
- `add_track`: Add custom data tracks
- `add_variant`: Add SNP/variant data

## How to Use in Chat

### Simple Examples

**Calculate GC Content:**
```
User: "What's the GC content of ATGCGCTATCG?"
LLM: {"tool_name": "compute_gc", "parameters": {"sequence": "ATGCGCTATCG"}}
Result: 63.64% GC content
```

**Find a Gene:**
```
User: "Find the lacZ gene"
LLM: {"tool_name": "search_gene_by_name", "parameters": {"name": "lacZ"}}
Result: Gene location and details
```

**Navigate to Position:**
```
User: "Go to position 123456 to 125000 on chromosome 1"
LLM: {"tool_name": "navigate_to", "parameters": {"chromosome": "chr1", "start": 123456, "end": 125000}}
Result: View navigated to specified region
```

### Complex Multi-Step Analysis

**Complete Promoter Analysis:**
```
User: "Analyze the promoter region of the dnaA gene"

LLM performs:
1. {"tool_name": "search_gene_by_name", "parameters": {"name": "dnaA"}}
2. {"tool_name": "get_upstream_region", "parameters": {"geneObj": "result1", "length": 200}}
3. {"tool_name": "compute_gc", "parameters": {"sequence": "upstream_sequence"}}
4. {"tool_name": "predict_promoter", "parameters": {"seq": "upstream_sequence"}}
5. {"tool_name": "navigate_to", "parameters": {"chromosome": "chr", "start": "start", "end": "end"}}
```

**Motif Discovery Near Genes:**
```
User: "Find TATAAT motifs and see what genes are nearby"

LLM performs:
1. {"tool_name": "search_sequence_motif", "parameters": {"pattern": "TATAAT"}}
2. {"tool_name": "search_by_position", "parameters": {"chromosome": "chr1", "position": "motif_pos"}}
3. Analysis and correlation
```

## Testing the Integration

### Through Chat Interface:

1. **Open Settings**: Click the ⚙️ Settings button in chat
2. **Run Tests**: Select "Test MicrobeGenomics integration"
3. **Check Results**: Verify all functions are available

### Through Console:

```javascript
// Test integration
window.chatManager.testMicrobeGenomicsIntegration()

// Test tool execution
await window.chatManager.testToolExecution()

// Test individual function
await window.chatManager.executeToolByName('compute_gc', {sequence: 'ATGC'})
```

## LLM Prompt Engineering

### System Message Includes:

1. **Function Categories**: Organized list of available functions
2. **Usage Examples**: Step-by-step examples for complex tasks
3. **Parameter Patterns**: How to structure function calls
4. **Chaining Examples**: Multi-step analysis workflows

### Tool Call Format:

```json
{
  "tool_name": "function_name",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

## Error Handling

### Function-Level:
- Parameter validation
- Graceful error messages
- Fallback to default values

### Integration-Level:
- Tool availability checking
- Result format standardization
- Error propagation to LLM

## Performance Considerations

### Function Design:
- **Atomic**: Each function does one thing
- **Pure**: No side effects (except navigate/edit functions)
- **Fast**: Optimized for real-time chat responses

### Caching:
- Results can be cached for repeated analyses
- Sequence data cached automatically
- Position-based queries optimized

## Examples of Complex Workflows

### 1. Gene Neighborhood Analysis
```
Find lacZ → Get upstream/downstream → Analyze GC content → 
Find motifs → Predict regulatory elements → Visualize region
```

### 2. Comparative Genomics
```
Find gene1 → Get sequence → Find similar sequences → 
Compare GC content → Analyze codon usage → 
Find orthologs in other regions
```

### 3. Regulatory Element Discovery
```
Find intergenic regions → Search for promoter motifs → 
Predict RBS sites → Find transcription terminators → 
Analyze spacing patterns
```

## Troubleshooting

### Common Issues:

1. **Functions Not Available**: Check console for loading errors
2. **Parameter Errors**: Verify parameter names and types
3. **No Results**: Check data is loaded and genome is selected

### Debug Commands:

```javascript
// Check if functions loaded
console.log(window.MicrobeFns)

// Test specific function
window.MicrobeFns.computeGC('ATGC')

// Check integration
window.chatManager.MicrobeFns
```

## Future Enhancements

### Planned Features:
- More prediction algorithms
- Batch processing functions
- Statistical analysis tools
- Visualization helpers
- Export utilities

### Integration Improvements:
- Smarter parameter handling
- Better error messages
- Progress indicators for long operations
- Result caching and history

---

This integration provides a powerful foundation for AI-assisted genomic analysis, making complex bioinformatics workflows accessible through natural language conversation. 