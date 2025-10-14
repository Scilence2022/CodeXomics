# InterPro Application Codes - Final Fix (2025-10-14)

## Issue
InterPro API was rejecting application codes with error:
```
Value for "appl" is not valid: Currently "ProSiteProfiles" but should be one of the restricted values...
```

## Root Cause
The application code mapping was incorrect. The label names shown in the UI don't always match the actual API parameter values required by the EBI InterProScan 5 REST API.

## Solution
Retrieved the official valid application codes directly from the EBI API:
```bash
curl 'https://www.ebi.ac.uk/Tools/services/rest/iprscan5/parameterdetails/appl'
```

## Key Corrections

### Critical Case Differences
| Label (UI) | Correct API Value | Previous (Wrong) |
|------------|-------------------|------------------|
| ProSiteProfiles | **PrositeProfiles** | ProSiteProfiles |
| PANTHER | **Panther** | PANTHER |
| Gene3D | **Gene3d** | Gene3D |
| SUPERFAMILY | **SuperFamily** | SUPERFAMILY |
| Pfam | **PfamA** | NCBIfam |
| Hamap | **HAMAP** | HAMAP |

### Complete Valid Application Codes (As of 2025-10-14)

1. **PfamA** - Pfam protein families
2. **NCBIfam** - Formerly TIGRFAMs
3. **SMART** - Domain architectures
4. **PrositeProfiles** - PROSITE profiles (note: lowercase 'rofiles')
5. **PrositePatterns** - PROSITE patterns
6. **Panther** - Protein families (capital P only)
7. **Gene3d** - CATH-Gene3D (lowercase 'd')
8. **HAMAP** - Microbial proteomes
9. **PRINTS** - Protein fingerprints
10. **PIRSF** - PIR superfamilies
11. **PIRSR** - PIR site rules
12. **SuperFamily** - Structural annotations (capital S and F)
13. **SFLD** - Structure-function linkage database
14. **CDD** - Conserved domain database
15. **Phobius** - Transmembrane topology predictor
16. **SignalP** - Signal peptide predictor (general)
17. **SignalP_EUK** - SignalP for eukaryotes
18. **SignalP_GRAM_POSITIVE** - SignalP for gram-positive bacteria
19. **SignalP_GRAM_NEGATIVE** - SignalP for gram-negative bacteria
20. **Coils** - Coiled coil predictor
21. **MobiDBLite** - Intrinsically disordered regions
22. **TMHMM** - Transmembrane helix predictor
23. **AntiFam** - Spurious protein predictions
24. **FunFam** - CATH functional families

## Files Modified
- `/src/renderer/modules/ChatManager.js` (lines ~6517-6547)
  - Updated application code mapping with correct case-sensitive values
  - Added comprehensive mapping for all 24 available applications
  - Added comments with API source and retrieval date

## Testing
After this fix, the InterPro API should accept all application codes correctly. Test with:
```javascript
applications = ['Pfam', 'SMART', 'PROSITE', 'PANTHER', 'Gene3D', 'SUPERFAMILY']
// Should map to: ['PfamA', 'SMART', 'PrositeProfiles', 'Panther', 'Gene3d', 'SuperFamily']
```

## API Reference
- **API Endpoint**: https://www.ebi.ac.uk/Tools/services/rest/iprscan5/run
- **Parameter Details**: https://www.ebi.ac.uk/Tools/services/rest/iprscan5/parameterdetails/appl
- **Documentation**: https://interproscan-docs.readthedocs.io/

## Important Notes
1. **Case Sensitivity**: The API is case-sensitive. "PrositeProfiles" ≠ "ProSiteProfiles"
2. **Pfam vs NCBIfam**: Pfam itself uses "PfamA" code, while NCBIfam is the renamed TIGRFAMs
3. **Default Applications**: All applications are enabled by default in the API
4. **No Deprecated Codes**: Removed old codes like 'ProDom' which are no longer available

## Related Issues
- Initial mock data fix: INTERPRO_REAL_API_FIX.md
- Parameter mapping fix: INTERPRO_API_400_ERROR_FIX.md
- Email validation fix: INTERPRO_EMAIL_VALIDATION_FIX.md
- NCBIfam confusion fix: INTERPRO_APPLICATION_CODES_UPDATE.md
- **This fix**: Final resolution of all application code issues
