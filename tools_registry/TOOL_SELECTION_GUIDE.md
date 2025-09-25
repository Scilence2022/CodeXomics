# Tool Selection Optimization Guide

## Gene Navigation Tools - Corrected Selection Logic

### Problem Identified
The LLM was incorrectly choosing `search_gene_by_name` over `jump_to_gene` for direct navigation requests like "navigate to lysC gene". This was caused by:

1. **Wrong parameters in jump_to_gene**: Had `chromosome`, `start`, `end` instead of `geneName`
2. **Misleading descriptions**: Both tools seemed suitable for navigation
3. **No clear priority hierarchy**: Both had priority 1

### Corrected Tool Hierarchy

#### 1. `jump_to_gene` - PRIMARY Navigation Tool
**Use for**: Direct navigation to known genes
```yaml
Description: "Jump directly to a gene location by gene name or locus tag. This is the PRIMARY tool for navigating to genes when you know the gene name."
Priority: 1
Parameters: geneName (required)
Examples:
  - "navigate to lysC gene" → jump_to_gene(geneName='lysC')
  - "go to lacZ" → jump_to_gene(geneName='lacZ')
```

#### 2. `search_gene_by_name` - FALLBACK Search Tool  
**Use for**: Fuzzy searches, partial matches, when jump_to_gene fails
```yaml
Description: "Search for genes by name with partial matching support. Use as FALLBACK when jump_to_gene fails or for fuzzy matching."
Priority: 2
Parameters: name, exact_match, navigate_to_gene
Examples:
  - "find genes containing 'ara'" → search_gene_by_name(name='ara', exact_match=false)
  - "search for lysC if jump fails" → search_gene_by_name(name='lysC', navigate_to_gene=true)
```

### Expected LLM Behavior After Fix

| User Query | Correct Tool Selection | Reasoning |
|------------|----------------------|-----------|
| "navigate to lysC gene" | `jump_to_gene(geneName='lysC')` | Direct navigation with known gene name |
| "go to lacZ" | `jump_to_gene(geneName='lacZ')` | Primary tool for direct gene navigation |
| "find genes like ara" | `search_gene_by_name(name='ara', exact_match=false)` | Fuzzy search scenario |
| "search for dnaA" | `jump_to_gene(geneName='dnaA')` | Even with "search" word, known gene = direct navigation |

### Validation Test Cases

To verify the fix is working, test these scenarios:

1. **Direct Navigation**: "navigate to lysC gene"
   - Expected: `jump_to_gene(geneName='lysC')`
   - NOT: `search_gene_by_name`

2. **Fuzzy Search**: "find all genes containing 'ara'"
   - Expected: `search_gene_by_name(name='ara', exact_match=false)`

3. **Error Recovery**: If jump_to_gene fails, LLM should suggest search_gene_by_name

### Key Improvements Made

1. **Clear Parameter Definition**: `jump_to_gene` now requires `geneName` parameter
2. **Explicit Priority**: PRIMARY vs FALLBACK clearly stated in descriptions
3. **Better Examples**: Realistic user queries with correct tool calls
4. **Relationship Mapping**: Tools now reference each other as alternatives
5. **Usage Pattern**: `jump_to_gene` = frequent, `search_gene_by_name` = occasional

### Tool Selection Principles

1. **Specificity First**: Use the most specific tool for the task
2. **Primary Over Fallback**: Always try primary tools before fallbacks
3. **Clear Intent Mapping**: Direct navigation → jump_to_gene, Search → search_gene_by_name
4. **Error Recovery**: Provide clear fallback paths when primary tools fail

This optimization ensures LLMs make correct tool choices and provide better user experience.