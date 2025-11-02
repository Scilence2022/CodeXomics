# InterPro Organism Parameter Fix

## Issue
When analyzing protein sequences using the InterPro tool, the organism was always showing as "Homo sapiens" even when analyzing sequences directly provided by users without organism information.

### Example Problem
```
User provides a raw protein sequence (no organism specified)
↓
InterPro analysis result shows:
- Organism: Homo sapiens  ❌ (WRONG - should be "Not specified")
```

## Root Cause
The `analyzeInterProDomains` function had a hardcoded default value for the organism parameter:
```javascript
organism = 'Homo sapiens',  // ❌ Always defaults to human
```

This caused ALL direct sequence submissions to be labeled as human sequences, which is misleading and incorrect.

## Solution

### 1. Removed Default Organism Value
Changed the default from `'Homo sapiens'` to `null`:
```javascript
organism = null,  // ✅ No default assumption
```

### 2. Context-Aware Organism Handling

#### For Direct Sequence Input (no organism info)
```javascript
protein_info: {
    id: 'USER_PROVIDED',
    name: 'User sequence',
    organism: organism || 'Not specified',  // ✅ Honest representation
    length: cleanSequence.length
}
```

#### For Gene Name Searches (organism needed for UniProt query)
```javascript
const searchOrganism = organism || 'Homo sapiens';  // ✅ Reasonable default for gene searches
console.log('Searching UniProt for gene:', geneName, 'organism:', searchOrganism);
```

#### For UniProt ID Lookups (organism extracted from FASTA header)
```javascript
// Extract organism from FASTA header if available
const organismMatch = header.match(/OS=([^=]+?)(?:OX=|GN=|PE=|SV=|$)/);
const detectedOrganism = organismMatch ? organismMatch[1].trim() : searchOrganism;

protein_info: {
    organism: detectedOrganism,  // ✅ Real organism from database
    ...
}
```

### 3. Improved Gene Search with Organism Detection
Enhanced the gene name search to extract the actual organism from the UniProt FASTA header:

```javascript
// Before
organism: organism,  // Always uses parameter value

// After
const organismMatch = header.match(/OS=([^=]+?)(?:OX=|GN=|PE=|SV=|$)/);
const detectedOrganism = organismMatch ? organismMatch[1].trim() : searchOrganism;
organism: detectedOrganism,  // ✅ Extracted from actual data
```

## Updated Behavior

### Scenario 1: Direct Sequence (No Organism Specified)
```javascript
// Input
{
    sequence: "MKTAYIAKQRQ...",
    // No organism parameter
}

// Output
{
    protein_info: {
        organism: "Not specified"  // ✅ Honest
    }
}
```

### Scenario 2: Direct Sequence (Organism Specified)
```javascript
// Input
{
    sequence: "MKTAYIAKQRQ...",
    organism: "Escherichia coli"
}

// Output
{
    protein_info: {
        organism: "Escherichia coli"  // ✅ Uses user's input
    }
}
```

### Scenario 3: Gene Name Search
```javascript
// Input
{
    geneName: "BRCA1",
    organism: "Mus musculus"
}

// Output - organism detected from UniProt header
{
    protein_info: {
        organism: "Mus musculus (Mouse)"  // ✅ Extracted from FASTA
    }
}
```

### Scenario 4: Gene Name Search (No Organism)
```javascript
// Input
{
    geneName: "TP53"
    // No organism - defaults to human for gene search
}

// Search uses: "Homo sapiens" (reasonable default for gene names)
// Output shows organism extracted from actual UniProt data
{
    protein_info: {
        organism: "Homo sapiens (Human)"  // ✅ From database
    }
}
```

### Scenario 5: UniProt ID Lookup
```javascript
// Input
{
    uniprot_id: "P04637"
}

// Output - organism from FASTA header
{
    protein_info: {
        organism: "Homo sapiens (Human)"  // ✅ From UniProt record
    }
}
```

## Files Modified

### `/src/renderer/modules/ChatManager.js`

1. **analyzeInterProDomains function** (line ~6404)
   - Changed default: `organism = null`
   - Updated protein_info creation: `organism: organism || 'Not specified'`

2. **Gene search enhancement** (line ~6467)
   - Added organism extraction from FASTA header
   - Uses regex to parse `OS=` field
   - Falls back to search organism if extraction fails

3. **getUniProtEntry function** (line ~6984)
   - Changed default: `organism = null`
   - Added context-aware organism handling

## Benefits

1. **Accurate Results**: Users see correct organism information (or "Not specified" when unknown)
2. **No False Assumptions**: System doesn't assume all sequences are human
3. **Better for Multi-Species Studies**: Researchers working with bacteria, plants, etc. get correct labels
4. **Honest Uncertainty**: "Not specified" is better than misleading "Homo sapiens"
5. **Database Accuracy**: When using UniProt/gene lookups, organism is extracted from actual records

## Testing Verification

### Test Case 1: Direct Sequence
```javascript
const result = await analyzeInterProDomains({
    sequence: "MSKGEELFTGVVP..."  // GFP sequence
});
// Expected: organism = "Not specified" ✅
```

### Test Case 2: Gene Search with Organism
```javascript
const result = await analyzeInterProDomains({
    geneName: "gfp",
    organism: "Aequorea victoria"
});
// Expected: organism extracted from UniProt record ✅
```

### Test Case 3: UniProt ID
```javascript
const result = await analyzeInterProDomains({
    uniprot_id: "P42212"  // GFP
});
// Expected: organism = "Aequorea victoria (jellyfish)" from database ✅
```

## Related Documentation
- Main tool reconstruction: `BIOINFORMATICS_TOOLS_RECONSTRUCTION.md`
- Real API integration: `INTERPRO_REAL_API_FIX.md`
- Application codes fix: `INTERPRO_APPLICATION_CODES_FINAL_FIX.md`

## API Specification Compliance
This fix ensures compliance with the project specification memory:
- **InterPro Tool Input Flexibility**: Supports flexible input (sequence, geneName+organism, or uniprot_id)
- **No False Defaults**: Removed misleading default organism assumption
- **Real Data Integration**: Extracts organism from actual database records when possible
