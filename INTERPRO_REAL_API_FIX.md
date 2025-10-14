# InterPro Real API Integration Fix

## Problem Identified

The `analyze_interpro_domains` tool was using **mock/simulated data** instead of calling the real InterPro web service.

**Previous behavior:**
```javascript
// Mock domain analysis results
const mockDomains = [
    {
        accession: 'PF00069',
        name: 'Protein kinase domain',
        type: 'Domain',
        start: 15,
        end: 270,
        evalue: 1.2e-45,
        database: 'Pfam',
        description: 'Serine/threonine/tyrosine protein kinase catalytic domain'
    },
    // ... more mock data
];
```

## Solution Implemented

### ✅ Real InterPro REST API Integration

Now uses the **official EBI InterProScan 5 REST API**:

**API Endpoint**: `https://www.ebi.ac.uk/Tools/services/rest/iprscan5/`

**Complete workflow:**

1. **Sequence Resolution** (if needed)
   - If `uniprot_id` provided → Fetch from UniProt REST API
   - If `geneName` provided → Search UniProt for gene
   - If `sequence` provided → Use directly

2. **Job Submission**
   ```
   POST https://www.ebi.ac.uk/Tools/services/rest/iprscan5/run
   Parameters:
   - sequence: protein sequence
   - appl: Pfam,SMART,PROSITE,etc
   - goterms: true/false
   - pathways: true/false
   ```

3. **Status Polling**
   ```
   GET https://www.ebi.ac.uk/Tools/services/rest/iprscan5/status/{jobId}
   Poll every 5 seconds (max 60 attempts = 5 minutes)
   Status: RUNNING → FINISHED/FAILED/ERROR
   ```

4. **Result Retrieval**
   ```
   GET https://www.ebi.ac.uk/Tools/services/rest/iprscan5/result/{jobId}/json
   Returns complete InterPro analysis with:
   - Domain matches from all databases
   - GO term annotations
   - Pathway cross-references
   - Signature details
   ```

## Key Changes

### File: `/src/renderer/modules/ChatManager.js`

**Lines changed**: ~141 lines replaced with 219 lines of real API integration

### Before (Mock Implementation)
```javascript
// Mock domain analysis results
const mockDomains = [...];
return { 
    success: true, 
    domain_architecture: mockDomains,
    note: 'This is a demonstration result'
};
```

### After (Real API Implementation)
```javascript
// Submit job to InterProScan
const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
});

const jobId = await submitResponse.text();

// Poll for results
while (status === 'RUNNING' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const statusResponse = await fetch(statusUrl);
    status = await statusResponse.text();
}

// Get real results
const resultResponse = await fetch(resultUrl);
const interproData = await resultResponse.json();
```

## Features

### ✅ Real Data Integration
- **Actual InterPro database** matches
- **Real E-values** and scores
- **Genuine GO terms** from InterPro
- **Authentic pathway** cross-references

### ✅ Multiple Input Methods
1. **Direct Sequence**: Provide protein sequence
2. **UniProt ID**: Auto-fetch sequence from UniProt
3. **Gene Name**: Search and retrieve sequence

### ✅ Comprehensive Analysis
- **Multiple databases**: Pfam, SMART, PROSITE, PANTHER, Gene3D, etc.
- **GO term annotation**: Biological Process, Molecular Function, Cellular Component
- **Pathway data**: KEGG, Reactome, MetaCyc cross-references
- **Domain architecture**: Complete positional information

### ✅ Robust Error Handling
- Network error handling
- Timeout protection (5 minutes max)
- Status validation
- Clear error messages

## API Response Structure

### Real InterPro JSON Response
```json
{
  "results": [
    {
      "sequence": "MGKI...",
      "matches": [
        {
          "signature": {
            "accession": "PF00069",
            "name": "Pkinase",
            "description": "Protein kinase domain",
            "type": "DOMAIN",
            "signatureLibraryRelease": {
              "library": "PFAM"
            }
          },
          "locations": [
            {
              "start": 15,
              "end": 270,
              "score": 1.2e-45
            }
          ],
          "entry": {
            "accession": "IPR000719",
            "name": "Protein kinase domain",
            "goXRefs": [
              {
                "id": "GO:0004672",
                "category": "MOLECULAR_FUNCTION",
                "name": "protein kinase activity"
              }
            ],
            "pathwayXRefs": [
              {
                "id": "R-HSA-5673001",
                "name": "RAF/MAP kinase cascade",
                "databaseName": "Reactome"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

## Testing

### Test Case 1: Direct Sequence Analysis
```javascript
await chatManager.analyzeInterProDomains({
  sequence: "MGKIIGIDLGTTNSCVAIMDGTTPRVLENAEGDRTTPSIIAYTQDGETLVGQPAKRQAVTNPQNTLFAIKRLIGRRFQDEEVQRDVSIMPFKIIAADNGDAWVEVKGQKMAPPQISAEVLKKMKKTAEDYLGEPVTEAVITVPAYFNDAQRQATKDAGRIAGLEVKRIINEPTAAALAYGLDKGTGNRTIAVYDLGGGTFDISIIEIDEVDGEKTFEVLATNGDTHLGGEDFDSRLINYLVEEFKKDQGIDLRNDPLAMQRLKEAAEKAKIELSSAQQTDVNLPYITADATGPKHMNIKVTRAKLESLVEDLVNRSIEPLKVALQDAGLSVSDIDDVILVGGQTRMPMVQKKVAEFFGKEPRKDVNPDEAVAIGAAVQGGVLTGDVKDVLLLDVTPLSLGIETMGGVMTTLIAKNTTIPTKHSQVFSTAEDNQSAVTIHVLQGERKRAADNKSLGQFNLDGINPAPRGMPQIEVTFDIDADGILHVSAKDKNSGKEQKITIKASSGLNEDEIQKMVRDAEANAEADRKFEELVQTRNQGDHLLHSTRKQVEEAGDKLPADDKTAIESALTALETALKGEDKAAIEAKMQELAQVSQKLMEIAQQQHAQQQTAGADASANNAKDDDVVDAEFEEVKDKK",
  applications: ['Pfam', 'SMART', 'PROSITE'],
  goterms: true,
  pathways: true
});
```

**Expected Output:**
```
🌐 [ChatManager] Calling InterPro REST API (InterProScan 5)...
✅ [ChatManager] InterPro job submitted: iprscan5-R20250114-123456-0789-12345678-p1m
⏳ [ChatManager] InterPro job status: RUNNING (attempt 1/60)
⏳ [ChatManager] InterPro job status: RUNNING (attempt 2/60)
⏳ [ChatManager] InterPro job status: RUNNING (attempt 3/60)
⏳ [ChatManager] InterPro job status: FINISHED (attempt 4/60)
✅ [ChatManager] InterPro results retrieved successfully
✅ [ChatManager] Real InterPro analysis completed: {
  total_domains: 8,
  domain_coverage: 92.3,
  databases_searched: ['Pfam', 'SMART', 'PROSITE'],
  go_terms_found: 15,
  pathways_found: 3
}
```

### Test Case 2: UniProt ID Analysis
```javascript
await chatManager.analyzeInterProDomains({
  uniprot_id: 'P04637',  // TP53
  applications: ['Pfam', 'SMART'],
  goterms: true
});
```

**Expected:**
- Fetches sequence from UniProt
- Analyzes with InterPro
- Returns real domain data for TP53

### Test Case 3: Gene Name Search
```javascript
await chatManager.analyzeInterProDomains({
  geneName: 'BRCA1',
  organism: 'Homo sapiens',
  applications: ['Pfam', 'Gene3D'],
  pathways: true
});
```

**Expected:**
- Searches UniProt for BRCA1
- Retrieves sequence
- Performs InterPro analysis
- Returns domain architecture

## Performance

### Timing
- **Job Submission**: ~1-2 seconds
- **Analysis Time**: 10 seconds - 3 minutes (depends on sequence length)
- **Result Retrieval**: ~1 second
- **Total**: Typically 20-120 seconds for average proteins

### Limits
- **Max Analysis Time**: 5 minutes (configurable)
- **Max Sequence Length**: ~50,000 AA (InterPro limit)
- **Polling Interval**: 5 seconds
- **Max Polling Attempts**: 60 (total 5 minutes)

## Error Messages

### Clear User-Facing Errors

1. **No sequence provided**:
   ```
   Error: No valid protein sequence provided. Please provide sequence, UniProt ID, or gene name.
   ```

2. **UniProt ID not found**:
   ```
   Error: Failed to retrieve UniProt sequence: UniProt ID P99999 not found
   ```

3. **Gene not found**:
   ```
   Error: Failed to search UniProt: Gene INVALID not found in UniProt
   ```

4. **API timeout**:
   ```
   Error: InterPro API error: InterPro analysis timeout - sequence may be too long or service is busy. Please check your internet connection and try again.
   ```

5. **Network error**:
   ```
   Error: InterPro API error: Failed to fetch. Please check your internet connection and try again.
   ```

## Result Format

### Standardized Output
```javascript
{
  success: true,
  tool: 'analyze_interpro_domains',
  timestamp: '2025-01-14T12:34:56.789Z',
  job_id: 'iprscan5-R20250114-123456-0789-12345678-p1m',
  protein_info: {
    id: 'P04637',
    name: 'TP53_HUMAN',
    organism: 'Homo sapiens',
    length: 393
  },
  sequence_length: 393,
  domain_architecture: [
    {
      accession: 'PF00870',
      name: 'P53',
      type: 'Domain',
      start: 94,
      end: 312,
      evalue: 2.3e-78,
      database: 'Pfam',
      description: 'P53 DNA-binding domain',
      interpro_entry: 'IPR011615'
    }
    // ... more domains
  ],
  go_terms: [
    {
      id: 'GO:0003677',
      category: 'MOLECULAR_FUNCTION',
      name: 'DNA binding'
    }
    // ... more GO terms
  ],
  pathways: [
    {
      id: 'R-HSA-69306',
      name: 'DNA Double-Strand Break Repair',
      database: 'Reactome'
    }
    // ... more pathways
  ],
  summary: {
    total_domains: 5,
    domain_coverage: 78.6,
    databases_searched: ['Pfam', 'SMART', 'PROSITE'],
    go_terms_found: 23,
    pathways_found: 8
  },
  message: 'Found 5 protein domains using real InterPro API',
  api_source: 'InterProScan 5 REST API (EBI)'
}
```

## Advantages of Real API

### ✅ vs Mock Data

| Feature | Mock Data | Real InterPro API |
|---------|-----------|-------------------|
| Domain Accuracy | ❌ Fake data | ✅ Scientifically validated |
| Database Coverage | ❌ Limited | ✅ 17+ databases |
| GO Terms | ❌ None/fake | ✅ Real annotations |
| Pathways | ❌ None | ✅ Real cross-refs |
| E-values | ❌ Random | ✅ Actual scores |
| Reproducibility | ❌ Not reproducible | ✅ Reproducible |
| Scientific Value | ❌ Demo only | ✅ Research-grade |

## Next Steps

### Recommended Enhancements

1. **Caching**: Cache results to avoid re-analyzing same sequences
2. **Progress UI**: Show real-time analysis progress in UI
3. **Batch Analysis**: Support multiple sequences
4. **Result Export**: Export to TSV, CSV, JSON formats
5. **Visualization**: Add domain architecture visualization

## Documentation

### API Documentation
- **InterProScan 5**: https://www.ebi.ac.uk/Tools/webservices/services/pfa/iprscan5_rest
- **UniProt REST API**: https://www.uniprot.org/help/api
- **InterPro Database**: https://www.ebi.ac.uk/interpro/

### Citation
If using in publications:
```
Blum M et al. (2021) The InterPro protein families and domains database: 20 years on. 
Nucleic Acids Research, 49(D1), D344-D354. doi:10.1093/nar/gkaa977
```

## Summary

✅ **Replaced mock data with real InterPro REST API**
✅ **Integrated UniProt sequence retrieval**
✅ **Full job submission and polling workflow**
✅ **Comprehensive error handling**
✅ **Real domain, GO term, and pathway data**
✅ **Production-ready implementation**

The tool now provides **scientifically accurate, research-grade protein domain analysis** using the official EBI InterPro service!
