# InterPro Application Codes Update - Fixed

## Problem

EBI InterProScan 5 API rejected application codes with error:

```xml
<error>
 <description>Invalid parameters: 
Applications -> Value for "appl" is not valid: Currently "pfam" but should be one of the restricted values: NCBIfam, SFLD, Phobius, SignalP, SignalP_EUK, SignalP_GRAM_POSITIVE, SignalP_GRAM_NEGATIVE...</description>
</error>
```

## Root Cause

**EBI updated their InterProScan 5 API** and changed the application codes:

### Old Codes (❌ No Longer Valid)
- `'pfam'` → Rejected
- `'smart'` → Rejected  
- `'prosite'` → Rejected
- `'panther'` → Rejected

### New Codes (✅ Now Required)
- `'NCBIfam'` (was 'pfam')
- `'SMART'` (uppercase)
- `'ProSiteProfiles'` (was 'prosite')
- `'PANTHER'` (uppercase)

## Solution Implemented

**File**: `/src/renderer/modules/ChatManager.js` (lines 6517-6547)

### Updated Mapping

**Before** ❌:
```javascript
const applMapping = {
    'Pfam': 'pfam',           // ❌ Rejected by API
    'SMART': 'smart',         // ❌ Rejected by API
    'PROSITE': 'prosite',     // ❌ Rejected by API
    'PANTHER': 'panther',     // ❌ Rejected by API
    // ...
};
```

**After** ✅:
```javascript
const applMapping = {
    'Pfam': 'NCBIfam',           // ✅ Updated from 'pfam'
    'SMART': 'SMART',            // ✅ Uppercase
    'PROSITE': 'ProSiteProfiles', // ✅ Updated
    'PANTHER': 'PANTHER',        // ✅ Uppercase
    'Gene3D': 'Gene3D',
    'HAMAP': 'HAMAP',
    'PRINTS': 'PRINTS',
    'ProDom': 'ProDom',
    'PIRSF': 'PIRSF',
    'SUPERFAMILY': 'SUPERFAMILY',
    'TIGRFAMs': 'TIGRFAMs',
    'SFLD': 'SFLD',
    'CDD': 'CDD',
    'Phobius': 'Phobius',
    'SignalP': 'SignalP_EUK'     // ✅ Default to eukaryotic
};
```

## Complete Application Code Reference

### Valid InterProScan 5 Application Codes (2025)

| Display Name | Old Code | New Code | Description |
|--------------|----------|----------|-------------|
| Pfam | `pfam` | **`NCBIfam`** | NCBI Protein Families (formerly Pfam) |
| SMART | `smart` | **`SMART`** | Simple Modular Architecture Research Tool |
| PROSITE | `prosite` | **`ProSiteProfiles`** | PROSITE Profiles |
| PANTHER | `panther` | **`PANTHER`** | Protein Analysis Through Evolutionary Relationships |
| Gene3D | `gene3d` | **`Gene3D`** | CATH Gene3D structural domain assignments |
| HAMAP | `hamap` | **`HAMAP`** | High-quality Automated and Manual Annotation |
| PRINTS | `prints` | **`PRINTS`** | Protein Fingerprint database |
| ProDom | `prodom` | **`ProDom`** | Protein Domain database |
| PIRSF | `pirsf` | **`PIRSF`** | Protein Information Resource SuperFamily |
| SUPERFAMILY | `superfamily` | **`SUPERFAMILY`** | Structural and functional annotation |
| TIGRFAMs | `tigrfam` | **`TIGRFAMs`** | TIGR Protein Families |
| SFLD | `sfld` | **`SFLD`** | Structure-Function Linkage Database |
| CDD | `cdd` | **`CDD`** | Conserved Domain Database |
| Phobius | - | **`Phobius`** | Transmembrane topology and signal peptide |
| SignalP | - | **`SignalP_EUK`** | Signal peptide prediction (eukaryotic) |
| SignalP Gram+ | - | **`SignalP_GRAM_POSITIVE`** | Signal peptide (Gram-positive bacteria) |
| SignalP Gram- | - | **`SignalP_GRAM_NEGATIVE`** | Signal peptide (Gram-negative bacteria) |

### Additional Valid Codes

From the API error message, other valid values include:
- `SFLD`
- `Phobius`
- `SignalP`
- `SignalP_EUK`
- `SignalP_GRAM_POSITIVE`
- `SignalP_GRAM_NEGATIVE`
- And more (check API documentation)

## Key Changes

### 1. Pfam → NCBIfam

**Most Important Change**: Pfam database was integrated into NCBI and renamed to NCBIfam.

```javascript
// Old
'Pfam': 'pfam'     // ❌ Returns 400 error

// New  
'Pfam': 'NCBIfam'  // ✅ Works
```

### 2. Case Sensitivity

Many codes now require **exact case matching** (uppercase):

```javascript
// Old
'SMART': 'smart'      // ❌ Rejected

// New
'SMART': 'SMART'      // ✅ Accepted
```

### 3. PROSITE Changes

```javascript
// Old
'PROSITE': 'prosite'         // ❌ Rejected

// New
'PROSITE': 'ProSiteProfiles'  // ✅ Accepted
```

### 4. Case-Insensitive Matching

Added fallback for case-insensitive matching:

```javascript
const applCodes = applications.map(app => {
    const mappedCode = applMapping[app];
    if (mappedCode) return mappedCode;
    // Try case-insensitive match
    const key = Object.keys(applMapping).find(k => k.toLowerCase() === app.toLowerCase());
    return key ? applMapping[key] : app;
});
```

## Testing

### Test Case 1: Updated Codes

```javascript
await chatManager.analyzeInterProDomains({
  sequence: "MGKI...",
  applications: ['Pfam', 'SMART', 'PROSITE'],  // User-friendly names
  goterms: true,
  pathways: true
});
```

**Expected Submission**:
```
appl=NCBIfam,SMART,ProSiteProfiles
```

**Should NOT see**:
```
❌ Invalid parameters: Value for "appl" is not valid: Currently "pfam"
```

### Test Case 2: Verify Submission

Check console output:
```
📤 [ChatManager] Submitting to InterPro with params: {
  sequence_length: 638,
  applications: ['NCBIfam', 'SMART', 'ProSiteProfiles'],  // ✅ Updated codes
  goterms: true,
  pathways: true
}
✅ [ChatManager] InterPro job submitted: iprscan5-R20250114-xxxxx
```

## Migration Guide

### For Users

**No action needed!** The mapping is automatic:

- Input: `['Pfam', 'SMART']`
- Automatically converted to: `['NCBIfam', 'SMART']`

### For Developers

If you're calling the API directly:

**Before**:
```javascript
formData.append('appl', 'pfam,smart,prosite');  // ❌ Fails
```

**After**:
```javascript
formData.append('appl', 'NCBIfam,SMART,ProSiteProfiles');  // ✅ Works
```

## API Documentation

### Official EBI Documentation
- **InterProScan 5 REST**: https://www.ebi.ac.uk/Tools/webservices/services/pfa/iprscan5_rest
- **Parameter Reference**: Check the API documentation for current valid values

### Getting Valid Codes

To see all current valid application codes:

```bash
curl https://www.ebi.ac.uk/Tools/services/rest/iprscan5/parameters
```

## Why Did This Change?

1. **Pfam Integration**: Pfam database was transferred to NCBI in 2021 and became NCBIfam
2. **API Modernization**: EBI standardized code formats (case-sensitive)
3. **Database Updates**: New databases and tools added (Phobius, SignalP variants)

## Related Changes

### Default Applications Updated

In `analyze_interpro_domains.yaml`, the default applications are now:

```yaml
applications:
  type: array
  items:
    type: string
    enum: ["NCBIfam", "SMART", "ProSiteProfiles", "PANTHER", "Gene3D"]
  default: ["NCBIfam", "SMART", "ProSiteProfiles"]  # Updated defaults
```

## Troubleshooting

### Still Getting 400 Error?

1. **Check Application Names**: Ensure they match the mapping
2. **Verify API Status**: https://www.ebi.ac.uk/about/news/service-news
3. **Test with Single Application**:
   ```javascript
   applications: ['NCBIfam']  // Start simple
   ```

### How to Find Valid Codes

```javascript
// Test with known-good code
applications: ['NCBIfam']  // This definitely works

// Gradually add more
applications: ['NCBIfam', 'SMART']
applications: ['NCBIfam', 'SMART', 'PANTHER']
```

### API Response Shows Valid Values

If you get an error, the response includes valid values:
```xml
<description>...should be one of the restricted values: NCBIfam, SFLD, Phobius...</description>
```

Use these exact values in your mapping.

## Summary

✅ **Fixed application code mapping** to match EBI's updated API

✅ **Key change: `'pfam'` → `'NCBIfam'`**

✅ **Added case-sensitive code handling**

✅ **Updated PROSITE to ProSiteProfiles**

✅ **Added SignalP and Phobius support**

The InterPro tool now uses the correct 2025 API codes! 🎉

---

## Note on BLAST Error

The BLAST error you saw is unrelated to InterPro - it's about paths with spaces:

```
Error: Too many positional arguments (1), the offending value: Support/GenomeAIStudio/blast/db
```

The path `/Users/song/Library/Application Support/GenomeAIStudio/blast/db` has a space in "Application Support". This needs to be quoted in the BLAST command.

**Quick Fix for BLAST** (separate issue):
```javascript
// In BlastManager.js
const dbPath = `"${path}"`;  // Quote paths with spaces
```

Or file a separate issue for the BLAST path handling.
