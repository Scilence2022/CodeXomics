# BLAST Search Guide

This guide explains how to use the BLAST search functionality in the Electron Genome Viewer application.

## Overview

The Genome Viewer includes comprehensive BLAST search capabilities that allow you to:
- Search sequence similarity against NCBI databases
- Perform batch searches with multiple sequences
- Use advanced filtering and algorithm parameters
- Integrate with local BLAST servers via MCP

## Basic BLAST Search

### Using the UI

1. **Open BLAST Search**: Click the "BLAST" button in the top toolbar
2. **Select BLAST Type**: Choose from blastn, blastp, blastx, or tblastn
3. **Input Sequence**: 
   - Type/paste sequence directly
   - Upload a FASTA file
   - Load sequence from current genomic region
4. **Choose Database**: Select from available NCBI databases
5. **Set Parameters**: Adjust E-value, max targets, etc.
6. **Run Search**: Click "Run BLAST" to execute

### Using Chat/LLM Interface

You can perform BLAST searches through the chat interface using natural language or tool calls:

#### Natural Language Examples:
- "BLAST this sequence against the nucleotide database: ATGCGCTATCG"
- "Search for protein similarity: MKELLKAGWKELQP"
- "BLAST the current genomic region"

#### Tool Call Examples:
```json
{
  "tool_name": "blast_search",
  "parameters": {
    "sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGGAAAGAACTGCAGCCG",
    "blastType": "blastn",
    "database": "nt",
    "evalue": "0.01",
    "maxTargets": 50
  }
}
```

## Advanced BLAST Features

### Batch BLAST Search

Search multiple sequences simultaneously:

```json
{
  "tool_name": "batch_blast_search",
  "parameters": {
    "sequences": [
      {"id": "gene1", "sequence": "ATGCGCTATCG"},
      {"id": "gene2", "sequence": "ATGAAAGAATT"}
    ],
    "blastType": "blastn",
    "database": "nt",
    "maxTargets": 10
  }
}
```

### Advanced Search with Filtering

Perform BLAST with custom algorithms and result filtering:

```json
{
  "tool_name": "advanced_blast_search",
  "parameters": {
    "sequence": "ATGCGCTATCG",
    "blastType": "blastn",
    "database": "nt",
    "filters": {
      "minIdentity": 95,
      "minCoverage": 80,
      "maxEvalue": 1e-10
    },
    "algorithms": {
      "wordSize": "11",
      "matrix": "BLOSUM62"
    }
  }
}
```

### Search Current Genomic Region

BLAST the sequence from a specific genomic region:

```json
{
  "tool_name": "blast_sequence_from_region",
  "parameters": {
    "chromosome": "NC_000913.3",
    "start": 3423681,
    "end": 3424651,
    "blastType": "blastn",
    "database": "refseq_genomic"
  }
}
```

## Available Databases

### Nucleotide Databases
- **nt**: Nucleotide collection (all GenBank+EMBL+DDBJ+PDB sequences)
- **refseq_rna**: RefSeq RNA sequences
- **refseq_genomic**: RefSeq Genome sequences

### Protein Databases
- **nr**: Non-redundant protein sequences
- **swissprot**: UniProtKB/Swiss-Prot
- **pdb**: Protein Data Bank proteins

## BLAST Types

- **blastn**: Nucleotide sequence vs nucleotide database
- **blastp**: Protein sequence vs protein database
- **blastx**: Translated nucleotide sequence vs protein database
- **tblastn**: Protein sequence vs translated nucleotide database

## MCP BLAST Server Integration

For advanced features like local databases and batch processing, you can set up a local BLAST server.

### Setting Up Local BLAST Server

1. **Install BLAST+**:
   ```bash
   # On macOS with Homebrew
   brew install blast
   
   # On Ubuntu/Debian
   sudo apt-get install ncbi-blast+
   ```

2. **Set up databases** (optional for local databases)

3. **Run example MCP BLAST server**:
   ```bash
   cd examples
   node mcp-blast-server.js
   ```

4. **Configure in Genome Viewer**:
   - The BLAST server is pre-configured at `ws://localhost:3002`
   - Enable it in the MCP Server Manager if needed

### MCP BLAST Server Features

When connected to an MCP BLAST server, you get additional capabilities:
- Local database searches
- Batch processing optimization
- Custom algorithm parameters
- Database creation and management

## Parameters Reference

### Basic Parameters
- **sequence**: Query sequence (required)
- **blastType**: Type of BLAST search (required)
- **database**: Target database (required)
- **evalue**: E-value threshold (default: 0.01)
- **maxTargets**: Maximum number of results (default: 50)

### Advanced Parameters
- **wordSize**: Word size for initial matching
- **matrix**: Scoring matrix (BLOSUM62, PAM30, etc.)
- **gapOpen**: Gap opening penalty
- **gapExtend**: Gap extension penalty
- **lowComplexity**: Filter low complexity regions

### Filtering Options
- **minIdentity**: Minimum identity percentage
- **minCoverage**: Minimum coverage percentage
- **maxEvalue**: Maximum E-value threshold
- **excludePatterns**: Patterns to exclude from descriptions

## Result Interpretation

BLAST results include:
- **Accession**: Database identifier
- **Description**: Sequence description
- **Score**: Alignment score
- **E-value**: Expect value (lower = more significant)
- **Identity**: Percentage sequence identity
- **Coverage**: Query coverage percentage
- **Alignment**: Sequence alignment details

## Tips and Best Practices

1. **Choose appropriate databases**:
   - Use `nt` for general nucleotide searches
   - Use `nr` for general protein searches
   - Use RefSeq databases for high-quality sequences

2. **Adjust E-value thresholds**:
   - Stricter (lower) for specific matches
   - More relaxed (higher) for distant homologs

3. **Use batch searches** for multiple queries

4. **Apply filters** for high-specificity searches

5. **Check alignment details** for verification

## Troubleshooting

### Common Issues

1. **"BLAST functionality not available"**:
   - Check that BlastManager is initialized
   - Verify internet connection for NCBI searches

2. **"Sequence too short"**:
   - Minimum sequence length is 10 characters
   - Ensure sequence contains valid nucleotides/amino acids

3. **"Connection timeout"**:
   - Check internet connection
   - Try reducing maxTargets parameter

4. **"No results found"**:
   - Try relaxing E-value threshold
   - Check sequence for errors
   - Try different databases

### Getting Help

- Check browser console for detailed error messages
- Use the chat interface to ask for help with BLAST searches
- Refer to NCBI BLAST documentation for parameter details

## Examples

### DNA Sequence Analysis
```json
{
  "tool_name": "blast_search",
  "parameters": {
    "sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGGAAAGAACTGCAGCCG",
    "blastType": "blastn",
    "database": "nt"
  }
}
```

### Protein Homology Search
```json
{
  "tool_name": "blast_search",
  "parameters": {
    "sequence": "MKELLKAGWKELQPIKEYGIEAVALAYTYQKEQDAIDKELKENITPNVEKKLVWEALKLK",
    "blastType": "blastp",
    "database": "nr"
  }
}
```

### High-Specificity Search
```json
{
  "tool_name": "advanced_blast_search",
  "parameters": {
    "sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGG",
    "blastType": "blastn",
    "database": "nt",
    "filters": {
      "minIdentity": 98,
      "maxEvalue": 1e-20
    }
  }
}
``` 