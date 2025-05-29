# Enhanced Search Functionality

## Overview

The Electron Genome Browser now includes comprehensive search capabilities that can find both gene names and DNA sequences within the loaded genomic data.

## Search Types

### 1. Gene Name Search
- **Gene names**: Searches in the `gene` qualifier
- **Locus tags**: Searches in the `locus_tag` qualifier  
- **Product descriptions**: Searches in the `product` qualifier
- **Notes**: Searches in the `note` qualifier

**Examples**:
- `lacZ` - finds the lacZ gene
- `b0344` - finds gene by locus tag
- `beta-galactosidase` - finds genes by product description
- `ribosomal` - finds all ribosomal-related genes

### 2. DNA Sequence Search
- **Exact matches**: Finds exact DNA sequence matches
- **Case sensitivity**: Optional case-sensitive matching
- **Reverse complement**: Optional search for reverse complement sequences

**Examples**:
- `ATGCGATCG` - finds exact sequence matches
- `atgcgatcg` - case-insensitive by default
- Enable "Include reverse complement" to also search for `CGATCGCAT`

## Search Options

### Case Sensitive
- **Unchecked (default)**: Case-insensitive search
- **Checked**: Exact case matching for both gene names and sequences

### Include Reverse Complement
- **Unchecked (default)**: Search only forward strand
- **Checked**: Also search reverse complement of DNA sequences
- Only applies to valid DNA sequences (A, T, G, C, N)

## Search Results

### Result Display
- Shows up to 5 detailed matches in the alert dialog
- For more than 5 matches, shows count of additional results
- Automatically navigates to the first match with context

### Result Information
- **Gene matches**: Shows gene type, name, and product description
- **Sequence matches**: Shows position and sequence found
- **Position range**: Shows start and end positions (1-based)

### Navigation
- Automatically centers view on first match
- Shows 500bp context around the match
- Updates statistics and genome view

## Usage

### Quick Search (Header)
1. Type search term in the header search box
2. Press Enter or click the search button
3. Results appear immediately

### Advanced Search (Modal)
1. Click the search button or use Ctrl+F (Cmd+F on Mac)
2. Enter search term in the modal dialog
3. Configure search options if needed
4. Click "Search" button

### Search Tips
- **Gene names**: Use partial names for broader results
- **DNA sequences**: Use uppercase for clarity (case doesn't matter by default)
- **Mixed search**: The system automatically detects if input is a DNA sequence
- **Context**: Results show surrounding genomic context for better orientation

## Technical Details

### Search Algorithm
1. **Gene annotation search**: Searches all qualifier fields using substring matching
2. **Sequence search**: Uses efficient string indexOf for exact matches
3. **Reverse complement**: Automatically calculates and searches complement
4. **Result sorting**: All results sorted by genomic position
5. **Performance**: Optimized for large genomes and annotation sets

### Supported Formats
- **GenBank files**: Full gene annotation search
- **FASTA files**: Sequence search only
- **GFF/GTF files**: Gene annotation search in attributes
- **All formats**: DNA sequence search always available

## Examples

### Finding Specific Genes
```
Search: "lacZ"
Results: lacZ gene (beta-galactosidase) at position 366-1,203

Search: "ribosomal"
Results: Multiple ribosomal protein genes and rRNA genes
```

### Finding DNA Sequences
```
Search: "ATGAAACGC"
Options: Include reverse complement ✓
Results: 
1. Sequence match at position 1,234-1,242
2. Reverse complement match at position 5,678-5,686
```

### Mixed Search Results
```
Search: "promoter"
Results:
1. Gene: promoter region at position 100-150
2. Gene: sigma70 promoter at position 2,000-2,050
3. Sequence match: "promoter" in gene description
```

## Keyboard Shortcuts

- **Ctrl+F** (Cmd+F): Open search modal
- **Enter**: Execute search from header input
- **Escape**: Close search modal
- **Tab**: Navigate between search options

## Performance Notes

- **Large files**: Search is optimized for files up to several MB
- **Memory efficient**: Uses streaming search for very large sequences  
- **Real-time**: Results appear immediately for most searches
- **Caching**: Gene annotations cached for faster repeated searches 