# BLAST Function Tools - Quick Reference Guide

## 🚀 Quick Start

### For LLM/AI Usage
The BLAST tools are automatically available to the AI assistant through the Dynamic Tools Registry. No manual setup required!

### For Developers
```javascript
// Access via ChatManager instance
const chatManager = window.chatManager;

// Example: List databases
const databases = await chatManager.blastListDatabases();

// Example: Online BLAST search
const result = await chatManager.blastSearchOnline({
    sequence: "ATCGATCGATCG",
    blastType: "blastn",
    database: "nt"
});
```

---

## 📚 All Available Tools

### 🔍 Search Tools

#### 1. Online BLAST Search
```javascript
await chatManager.blastSearchOnline({
    sequence: string,        // DNA or protein sequence
    blastType: string,       // "blastn", "blastp", "blastx", "tblastn", "tblastx"
    database: string,        // "nt", "nr", "refseq_rna", etc.
    evalue: string,          // E-value threshold (default: "0.01")
    maxTargets: number       // Max results (default: 50)
});
```

**Returns**: `{ success: boolean, hits: Array, executionTime: number, timestamp: string }`

#### 2. Local BLAST Search
```javascript
await chatManager.blastSearchLocal({
    sequence: string,        // Query sequence
    database: string,        // Local database name
    blastType: string,       // BLAST program type
    evalue: string,          // E-value threshold
    numThreads: number       // Number of CPU threads
});
```

#### 3. Batch BLAST Search
```javascript
await chatManager.blastSearchBatch({
    sequences: Array,        // Array of sequences
    database: string,        // Database to search
    blastType: string,       // BLAST program
    parallel: boolean        // Run in parallel (default: true)
});
```

---

### 💾 Database Management Tools

#### 4. Create Database
```javascript
await chatManager.blastCreateDatabase({
    fastaFile: string,       // Path to FASTA file
    dbName: string,          // Database name
    dbType: string,          // "nucl" or "prot"
    title: string            // Database title (optional)
});
```

#### 5. List Databases
```javascript
await chatManager.blastListDatabases({
    // No parameters required
});
```

**Returns**: `{ success: boolean, databases: Array, count: number }`

#### 6. Database Info
```javascript
await chatManager.blastDatabaseInfo({
    dbName: string           // Database name
});
```

**Returns**: Database details including size, type, sequences, and creation date

#### 7. Delete Database
```javascript
await chatManager.blastDeleteDatabase({
    dbName: string           // Database name to delete
});
```

#### 8. Create Database from Genome
```javascript
await chatManager.blastCreateDbFromGenome({
    genomeId: string,        // Genome identifier
    dbName: string,          // Database name
    dbType: string           // "nucl" (nucleotide)
});
```

#### 9. Create Protein Database from Genome
```javascript
await chatManager.blastCreateProteinDbFromGenome({
    genomeId: string,        // Genome identifier
    dbName: string,          // Database name
    includeFrames: Array     // Translation frames: [1,2,3,-1,-2,-3]
});
```

**Special**: Performs 6-frame translation of nucleotide sequences

#### 10. Validate Database
```javascript
await chatManager.blastValidateDatabase({
    dbName: string           // Database to validate
});
```

---

### 📊 Analysis Tools

#### 11. Filter Results
```javascript
await chatManager.blastFilterResults({
    results: object,         // BLAST results object
    minEvalue: number,       // Minimum e-value (optional)
    minIdentity: number,     // Minimum identity % (optional)
    minCoverage: number,     // Minimum coverage % (optional)
    maxHits: number          // Maximum hits to return (optional)
});
```

#### 12. Export Results
```javascript
await chatManager.blastExportResults({
    results: object,         // BLAST results
    format: string,          // "json", "csv", "txt", "html"
    outputPath: string       // Export file path
});
```

---

### 🛠️ System Tools

#### 13. Detect Sequence Type
```javascript
await chatManager.blastDetectSequenceType({
    sequence: string         // Sequence to analyze
});
```

**Returns**: `{ sequenceType: "nucleotide"|"protein"|"unknown" }`

#### 14. Get Installation Status
```javascript
await chatManager.blastGetInstallationStatus({
    // No parameters required
});
```

**Returns**: BLAST+ installation status and version info

---

## 📈 Monitoring & Statistics

### Get Execution Statistics
```javascript
const stats = chatManager.blastFunctionTools.getExecutionStats();

console.log(stats);
// {
//   totalExecutions: 42,
//   successCount: 38,
//   failureCount: 4,
//   successRate: 90.48,
//   averageExecutionTime: 2500,
//   toolMetrics: Map { ... }
// }
```

### Get Tool-Specific Metrics
```javascript
const stats = chatManager.blastFunctionTools.getExecutionStats();
const onlineMetrics = stats.toolMetrics.get('blast_search_online');

console.log(onlineMetrics);
// {
//   executionCount: 15,
//   successCount: 14,
//   failureCount: 1,
//   averageExecutionTime: 3200,
//   minExecutionTime: 1500,
//   maxExecutionTime: 5000
// }
```

### Get Available Tools List
```javascript
const tools = chatManager.blastFunctionTools.getAvailableTools();
// ["blast_search_online", "blast_search_local", ...]
```

---

## 🎯 Common Use Cases

### Use Case 1: Quick Online Search
```javascript
// Simple NCBI BLAST search
const result = await chatManager.blastSearchOnline({
    sequence: mySequence,
    blastType: "blastn",
    database: "nt",
    evalue: "0.001"
});

if (result.success && result.hits.length > 0) {
    console.log(`Found ${result.hits.length} matches`);
    const topHit = result.hits[0];
    console.log(`Best match: ${topHit.accession} (E-value: ${topHit.evalue})`);
}
```

### Use Case 2: Create and Search Local Database
```javascript
// Step 1: Create database from genome
await chatManager.blastCreateDbFromGenome({
    genomeId: "ecoli_k12",
    dbName: "ecoli_genome",
    dbType: "nucl"
});

// Step 2: Search against local database
const result = await chatManager.blastSearchLocal({
    sequence: myGene,
    database: "ecoli_genome",
    blastType: "blastn",
    evalue: "0.01"
});
```

### Use Case 3: Batch Processing with Filtering
```javascript
// Batch search
const batchResult = await chatManager.blastSearchBatch({
    sequences: [seq1, seq2, seq3],
    database: "my_db",
    blastType: "blastn"
});

// Filter results
const filtered = await chatManager.blastFilterResults({
    results: batchResult,
    minIdentity: 95,
    minCoverage: 80,
    maxHits: 10
});
```

### Use Case 4: Protein Database Creation
```javascript
// Create protein database with 6-frame translation
await chatManager.blastCreateProteinDbFromGenome({
    genomeId: "bacterial_genome",
    dbName: "bacterial_proteins",
    includeFrames: [1, 2, 3, -1, -2, -3]
});

// Search protein database
const result = await chatManager.blastSearchLocal({
    sequence: myProteinSequence,
    database: "bacterial_proteins",
    blastType: "blastp"
});
```

---

## 🔍 Parameter Reference

### BLAST Types
- **blastn**: Nucleotide vs nucleotide
- **blastp**: Protein vs protein
- **blastx**: Translated nucleotide vs protein
- **tblastn**: Protein vs translated nucleotide
- **tblastx**: Translated nucleotide vs translated nucleotide

### NCBI Databases
- **nt**: Nucleotide collection
- **nr**: Non-redundant protein sequences
- **refseq_rna**: RefSeq RNA sequences
- **refseq_genomic**: RefSeq genomic sequences
- **refseq_protein**: RefSeq proteins
- **swissprot**: Swiss-Prot proteins
- **pdb**: Protein Data Bank
- **est**: Expressed Sequence Tags

### E-value Thresholds
- `"10"`: Very permissive (many hits)
- `"1"`: Default (moderate)
- `"0.01"`: Stringent
- `"0.001"`: Very stringent
- `"1e-5"`: Extremely stringent

---

## ⚠️ Error Handling

All tools return standardized error objects:

```javascript
try {
    const result = await chatManager.blastSearchOnline(params);
    if (!result.success) {
        console.error('BLAST failed:', result.error);
    }
} catch (error) {
    console.error('Exception:', error.message);
}
```

Common error types:
- **Parameter validation errors**: Missing or invalid parameters
- **BLAST+ not installed**: Local tools require BLAST+ installation
- **Database not found**: Specified database doesn't exist
- **Network errors**: Online search connectivity issues
- **Timeout errors**: Search exceeded time limit

---

## 🧪 Testing

### Quick Test
```javascript
// Test installation status
const status = await chatManager.blastGetInstallationStatus();
console.log('BLAST installed:', status.installed);

// Test database listing
const dbs = await chatManager.blastListDatabases();
console.log('Available databases:', dbs.count);

// Test sequence detection
const type = await chatManager.blastDetectSequenceType({
    sequence: "ATCGATCGATCG"
});
console.log('Sequence type:', type.sequenceType); // "nucleotide"
```

### Run Test Suite
Open in browser:
```
test-blast-function-tools-integration.html
```

---

## 📊 Performance Tips

1. **Use Local BLAST for Multiple Searches**
   - Create local database once
   - Search locally (much faster than NCBI)

2. **Batch Processing**
   - Use `blastSearchBatch()` for multiple sequences
   - Automatic parallelization for efficiency

3. **Filter Results Early**
   - Apply stringent e-value thresholds
   - Limit `maxTargets` to reduce processing time

4. **Monitor Performance**
   - Check execution statistics regularly
   - Identify slow tools and optimize

5. **Database Validation**
   - Validate databases before searching
   - Rebuild corrupted databases

---

## 🔗 Related Resources

- **Full Technical Docs**: `BLAST_FUNCTION_TOOLS_IMPLEMENTATION.md`
- **Integration Guide**: `BLAST_FUNCTION_TOOLS_FINAL_INTEGRATION.md`
- **Architecture Diagram**: `BLAST_ARCHITECTURE_DIAGRAM.md`
- **BlastManager Source**: `src/renderer/modules/BlastManager.js`
- **Test Suite**: `test-blast-function-tools-integration.html`

---

## 💡 Tips for LLM Usage

When using BLAST tools through natural language:

**Good prompts**:
- "Search this sequence against NCBI nucleotide database"
- "List all available BLAST databases"
- "Create a BLAST database from the current genome"
- "Find protein matches with e-value less than 0.001"

**The LLM will automatically**:
- Choose the right BLAST tool
- Detect sequence type (DNA/protein)
- Select appropriate database
- Set reasonable e-value thresholds
- Format and explain results

---

**Last Updated**: December 10, 2024  
**Version**: 1.0.0  
**Status**: Production Ready
