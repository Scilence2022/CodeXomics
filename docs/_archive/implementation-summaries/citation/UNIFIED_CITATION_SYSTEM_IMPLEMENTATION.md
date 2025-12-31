# Unified Citation System Implementation

## Overview

This document describes the implementation of a unified citation numbering system for the Gene Details sidebar in GenomeExplorer. The system collects all citations from all sections (Note, GO Process, GO Function, GO Component, etc.) and displays them with sequential numbering and a unified reference list at the bottom.

## Implementation Date

December 2024

## Feature Description

The unified citation system provides:

- **Unified Numbering**: All citations across all sections use sequential numbering [1], [2], [3], etc.
- **Citation Collection**: Automatically collects citations from Note, GO annotations, and other sections
- **Multiple Formats**: Supports PMID, DOI, arXiv, bioRxiv, ISBN, and CITS formats
- **Reference List**: Displays unified reference list at bottom of Gene Details panel
- **Clickable Links**: All citations are clickable and open in new tabs
- **Consistent Styling**: Professional appearance with numbered badges and proper spacing

## Technical Implementation

### Files Modified

1. **src/renderer/renderer-modular.js**
   - Added unified citation system methods
   - Modified `populateGeneDetails()` to use unified citations
   - Updated `enhanceGeneAttributeWithLinks()` to process unified citations

2. **src/renderer/styles.css**
   - Added CSS styles for citation display
   - Styled citation list, citation items, and superscript numbers

### New Methods Added

#### `addUnifiedCitation(citationType, citationId, citationText)`
- Adds a citation to the unified citation collector
- Returns the unified citation number
- Prevents duplicate citations

#### `processUnifiedCitations(text)`
- Processes text and replaces citations with unified numbered references
- Handles multiple citation formats (PMID, DOI, arXiv, bioRxiv, ISBN, CITS)
- Returns text with superscript numbered references

#### `generateUnifiedCitationList()`
- Generates HTML for the unified reference list
- Sorts citations by number
- Creates clickable links for each citation

#### `getCitationUrl(citationType, citationId)`
- Gets appropriate URL for citation type
- Supports multiple database links

### Supported Citation Formats

#### PMID References
- `PMID:1234567` or `PMID 1234567` → <sup>[1]</sup>
- `[1234567]` → <sup>[2]</sup>

#### DOI References
- `doi:10.1038/nature12345` or `DOI:10.1038/nature12345` → <sup>[3]</sup>

#### CITS Format
- `|CITS: [PMID1 PMID2]|` → `|CITS: <sup>[1, 2]</sup>|`

#### ArXiv References
- `arXiv:1234.5678` → <sup>[4]</sup>

#### bioRxiv References
- `bioRxiv:1234.5678` → <sup>[5]</sup>

#### ISBN References
- `ISBN-13: 978-0-123456-78-9` → <sup>[6]</sup>

### CSS Styling

```css
.gene-citations {
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    padding: 12px;
    margin-top: 16px;
    border: 1px solid var(--border-color);
}

.citation-number {
    font-size: 11px;
    font-weight: 600;
    color: var(--primary-color);
    background: rgba(59, 130, 246, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
    min-width: 20px;
    text-align: center;
}

sup {
    font-size: 0.75em;
    vertical-align: super;
    color: var(--primary-color);
    font-weight: 600;
}
```

## Usage Example

### Before (Scattered Citations)
```
Note: Threonine synthase carries out the final step |CITS: [PMID:4148765]|.
GO Process: threonine biosynthetic process [PMID:4148765]
GO Function: threonine synthase activity [PMID:6316258]
```

### After (Unified Citations)
```
Note: Threonine synthase carries out the final step |CITS: <sup>[1]</sup>|.
GO Process: threonine biosynthetic process <sup>[1]</sup>
GO Function: threonine synthase activity <sup>[2]</sup>

References:
[1] PMID:4148765
[2] PMID:6316258
```

## Benefits

1. **Consistency**: All citations use the same numbering system
2. **Clarity**: Easy to track references across all sections
3. **Professional**: Clean, academic-style citation format
4. **Accessibility**: Clickable links to original sources
5. **Maintainability**: Centralized citation management

## Testing

The implementation includes comprehensive testing through:
- Test file: `test/test-unified-citation-system.html`
- Various citation format examples
- Visual verification of numbering and links
- Cross-browser compatibility testing

## Future Enhancements

Potential future improvements could include:
- Citation export functionality
- Citation management tools
- Integration with reference management software
- Citation impact metrics
- Automatic citation validation

## Conclusion

The unified citation system significantly improves the user experience in the Gene Details sidebar by providing a consistent, professional, and accessible way to handle citations across all sections. The implementation is robust, maintainable, and follows best practices for academic citation formatting.
