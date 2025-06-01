# Enhanced Search Functionality

## Overview

Genome AI Studio features comprehensive search capabilities that can find both gene names and DNA sequences within loaded genomic data. The search system has been recently enhanced with **improved AI integration** and **corrected function calling** for more reliable and accurate results.

## 🆕 Recent Improvements

### **Fixed AI Search Function Calling**
- **Corrected LLM behavior**: AI assistant now properly uses `search_features` for text-based searches
- **Function distinction**: Clear separation between text search and position-based proximity search
- **Enhanced accuracy**: More reliable search function selection in natural language queries
- **Better integration**: Seamless interaction between manual search and AI-powered search

### **Enhanced Search Results**
- **Automatic results panel**: Search results automatically appear in left sidebar
- **One-click navigation**: Click any result to jump directly to that location
- **Visual indicators**: Color-coded badges for different result types
- **Context display**: Each result shows surrounding genomic context

## Search Types

### 1. **Text-Based Gene Search** 🔍
Searches through annotation text fields for matching content.

**Search Fields**:
- **Gene names**: Searches in the `gene` qualifier
- **Locus tags**: Searches in the `locus_tag` qualifier  
- **Product descriptions**: Searches in the `product` qualifier
- **Notes**: Searches in the `note` qualifier
- **Feature types**: Searches feature type fields

**Examples**:
```
lacZ                    → finds the lacZ gene
b0344                   → finds gene by locus tag
beta-galactosidase      → finds genes by product description
ribosomal               → finds all ribosomal-related genes
DNA polymerase          → finds polymerase genes
tRNA                    → finds all tRNA features
```

### 2. **DNA Sequence Search** 🧬
Finds exact DNA sequence matches within the genome.

**Features**:
- **Exact matches**: Finds exact DNA sequence matches
- **Case sensitivity**: Optional case-sensitive matching
- **Reverse complement**: Optional search for reverse complement sequences
- **Pattern recognition**: Automatically detects DNA vs gene name searches

**Examples**:
```
ATGCGATCG              → finds exact sequence matches
atgcgatcg              → case-insensitive by default
GAATTC                 → finds EcoRI restriction sites
TATAAA                 → finds TATA box sequences
```

### 3. **AI-Powered Natural Language Search** 🤖
Use natural language to search with the AI assistant.

**Text-Based AI Searches** (uses `search_features`):
```
"Find DNA polymerase genes"           ✅ Searches annotations
"Search for lacZ"                     ✅ Finds lacZ gene
"Show me ribosomal proteins"          ✅ Searches products
"Find genes with kinase activity"     ✅ Product search
"Look for tRNA genes"                 ✅ Feature type search
```

**Position-Based AI Searches** (uses `get_nearby_features`):
```
"What's near position 12345?"         ✅ Proximity search
"Find genes around coordinate 50000"  ✅ Spatial search
"Show features within 5kb of position X" ✅ Distance search
```

## Search Options

### **Case Sensitive**
- **Unchecked (default)**: Case-insensitive search for broader results
- **Checked**: Exact case matching for both gene names and sequences
- **Recommendation**: Leave unchecked for most searches

### **Include Reverse Complement**
- **Unchecked (default)**: Search only forward strand
- **Checked**: Also search reverse complement of DNA sequences
- **DNA only**: Only applies to valid DNA sequences (A, T, G, C, N)
- **Use case**: Finding sequences that might appear on either strand

### **Search Scope**
- **Current chromosome**: Search only the currently loaded chromosome
- **All chromosomes**: Search across all loaded genomic data
- **Custom regions**: Limit search to specific genomic regions

## Search Results

### **Automatic Results Panel** 📋
- **Auto-display**: Results panel automatically appears in left sidebar
- **One-click navigation**: Click any result to jump to that location
- **Result persistence**: Results remain available for continued exploration
- **Close functionality**: Hide panel with × button when done

### **Result Display Information**
**Gene matches**:
- Gene type (gene, CDS, tRNA, etc.)
- Gene name and locus tag
- Product description
- Genomic position (start-end)
- Strand information

**Sequence matches**:
- Exact sequence found
- Genomic position
- Forward or reverse complement
- Surrounding context

### **Visual Indicators**
- **Green badges**: Gene and annotation matches
- **Blue badges**: DNA sequence matches
- **Position display**: 1-based genomic coordinates
- **Hover effects**: Additional information on mouse hover
- **Selection highlighting**: Current result highlighted in blue

### **Navigation Features**
- **Auto-navigation**: Automatically shows first match with context
- **Context view**: Shows 500bp surrounding region
- **Zoom adjustment**: Optimal zoom level for viewing results
- **Result cycling**: Easy navigation through multiple matches

## Usage Methods

### 1. **Quick Search (Header)**
```
1. Type search term in header search box
2. Press Enter or click search button  
3. Results appear in sidebar automatically
4. Click results to navigate
```

### 2. **Advanced Search (Modal)**
```
1. Click search button or use Ctrl+F (Cmd+F on Mac)
2. Enter search term in modal dialog
3. Configure search options (case sensitivity, reverse complement)
4. Click "Search" button
5. View results in sidebar panel
```

### 3. **AI-Powered Search** 🤖
```
1. Click robot icon to open AI chat
2. Use natural language: "Find DNA polymerase"
3. AI automatically performs correct search
4. Results appear in sidebar
5. Follow up with additional questions
```

## Search Algorithm Details

### **Text Search Engine**
1. **Preprocessing**: Normalize search terms and target text
2. **Field searching**: Search all annotation qualifier fields
3. **Substring matching**: Use efficient string matching algorithms
4. **Result ranking**: Sort by relevance and genomic position
5. **Deduplication**: Remove duplicate matches from same feature

### **Sequence Search Engine**
1. **Pattern validation**: Verify input is valid DNA sequence
2. **Exact matching**: Use optimized string search (Boyer-Moore algorithm)
3. **Reverse complement**: Calculate and search complement if enabled
4. **Position tracking**: Record all match positions and contexts
5. **Overlap handling**: Manage overlapping sequence matches

### **AI Search Integration**
1. **Intent recognition**: Determine if search is text-based or position-based
2. **Function selection**: Choose correct search function (`search_features` vs `get_nearby_features`)
3. **Parameter optimization**: Set optimal search parameters
4. **Result presentation**: Format results for display
5. **Context preservation**: Maintain search context for follow-up queries

## Performance Optimization

### **Large Dataset Handling**
- **Indexing**: Pre-built search indices for faster lookups
- **Streaming search**: Process large files without memory overload
- **Result limiting**: Cap results to prevent UI overload
- **Background processing**: Non-blocking search execution

### **Memory Management**
- **Efficient storage**: Minimal memory footprint for search indices
- **Garbage collection**: Automatic cleanup of old search results
- **Cache management**: Smart caching of frequently searched terms

### **Search Speed**
- **Optimized algorithms**: Fast string matching and indexing
- **Progressive results**: Show results as they're found
- **Interrupt capability**: Allow cancellation of long searches

## Supported File Formats

| Format | Gene Search | Sequence Search | AI Integration |
|--------|-------------|-----------------|----------------|
| **GenBank** | ✅ Full annotation search | ✅ Complete sequence | ✅ Both functions |
| **GFF/GTF** | ✅ Attribute searching | ✅ Reference sequence | ✅ Both functions |
| **FASTA** | ❌ No annotations | ✅ Sequence only | ✅ Limited to sequence |
| **BED** | ✅ Name/description fields | ❌ No sequence | ✅ Annotation search |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+F** (Cmd+F) | Open advanced search modal |
| **Enter** | Execute search from header input |
| **Escape** | Close search modal or results panel |
| **Tab** | Navigate between search options |
| **↑/↓** | Navigate through search results |

## Search Examples

### **Gene Name Searches**
```
Input: "lacZ"
Results: lacZ gene (beta-galactosidase) at position 366-1,203

Input: "ribosomal"  
Results: Multiple ribosomal protein genes and rRNA genes
- rpsA (30S ribosomal protein S1) at 3,570-4,013
- rplT (50S ribosomal protein L20) at 4,100-4,423
- 16S ribosomal RNA at 4,520-6,063
```

### **Product Description Searches**
```
Input: "DNA polymerase"
Results: DNA polymerase genes across the genome
- polA (DNA polymerase I) at 3,826-6,819
- dnaE (DNA polymerase III alpha subunit) at 182,438-186,097

Input: "kinase"
Results: All protein kinases and related enzymes
```

### **DNA Sequence Searches**
```
Input: "ATGAAACGC"
Options: Include reverse complement ✓
Results: 
1. Forward sequence match at position 1,234-1,242
2. Reverse complement match at position 5,678-5,686

Input: "GAATTC"
Results: EcoRI restriction sites throughout genome
```

### **AI Natural Language Searches**
```
User: "Find DNA polymerase genes"
AI: Uses search_features function
Results: All DNA polymerase annotations displayed in sidebar

User: "What's around position 50000?"  
AI: Uses get_nearby_features function
Results: Features within 5kb of position 50000
```

## Best Practices

### **Search Strategy**
- **Start broad**: Use general terms first, then refine
- **Use wildcards**: Partial gene names often yield better results
- **Check spelling**: Verify gene name spelling and synonyms
- **Try synonyms**: Use alternative names for genes/products

### **Result Interpretation**
- **Review context**: Check surrounding features for better understanding
- **Verify positions**: Confirm genomic coordinates are as expected
- **Cross-reference**: Use multiple search terms to confirm findings

### **AI Search Tips**
- **Be specific**: "Find lacZ gene" vs "search for something"
- **Use correct terms**: "DNA polymerase" vs "polymerase enzyme"  
- **Specify intent**: Make clear if you want text search vs position search
- **Follow up**: Ask clarifying questions about results

## Troubleshooting

### **Common Issues**

**No results found**:
- Check spelling of search terms
- Try partial gene names or synonyms
- Verify file contains annotations (for gene searches)
- Use case-insensitive search

**Too many results**:
- Use more specific search terms
- Enable case-sensitive search
- Search within specific genomic regions
- Use exact gene names rather than descriptions

**AI using wrong search function**:
- Be explicit: "search for gene name X" vs "find features near position Y"
- Use clear language about search intent
- Specify whether you want text-based or position-based search

**Performance issues**:
- Limit search scope to specific regions
- Use more specific search terms
- Close other browser tabs to free memory
- Try searching smaller portions of large genomes

### **Error Messages**
- **"No annotations loaded"**: Load GenBank or GFF file for gene searches
- **"Invalid DNA sequence"**: Check sequence contains only A,T,G,C,N characters
- **"Search cancelled"**: Search was interrupted, try again with simpler terms 