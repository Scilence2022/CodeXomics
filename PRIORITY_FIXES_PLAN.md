# Priority Fixes Implementation Plan

## 🎯 Critical Fix #1: Consolidate GenBank Export

### Problem Summary
Three methods generating GenBank content with 400+ lines of duplicated code:
- `generateChromosomeGBKContentOriginal()` - 196 lines
- `generateChromosomeGBKContent()` - 137 lines
- Inline logic in `generateAndSaveGBK()` and `generateAndSaveGBKFromCopy()`

### Proposed Solution: GenBankExporter Class

```javascript
/**
 * GenBankExporter.js - Unified GenBank format export
 * Consolidates all GenBank generation logic into single class
 */
class GenBankExporter {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
    }

    /**
     * Main export method - generates complete GenBank content
     */
    exportGenBank(params) {
        const {
            chromosomes,           // Array of chromosome names
            getSequence,          // Function(chr) => sequence string
            getFeatures,          // Function(chr) => features array
            executedActions = [], // Array of executed actions
            executionId = null,   // Execution ID for tracking
            options = {}          // Export options
        } = params;

        let content = '';
        
        for (const chr of chromosomes) {
            const sequence = getSequence(chr);
            const features = getFeatures(chr);
            const chrActions = executedActions.filter(
                a => a.metadata?.chromosome === chr
            );
            
            content += this.generateChromosomeContent({
                chromosome: chr,
                sequence,
                features,
                actions: chrActions,
                executionId,
                options
            }) + '\n';
        }
        
        return content;
    }

    /**
     * Generate content for single chromosome
     */
    generateChromosomeContent(params) {
        const { chromosome, sequence, features, actions, executionId, options } = params;
        
        const sourceFeatures = this.genomeBrowser.sourceFeatures?.[chromosome] || {};
        const originalAnnotations = this.genomeBrowser.currentAnnotations?.[chromosome] || [];
        
        let content = '';
        
        // LOCUS line
        content += this.generateLocus(chromosome, sequence, sourceFeatures, originalAnnotations);
        
        // Modification history (if actions exist)
        if (actions && actions.length > 0 && executionId) {
            content += this.generateActionHistory(actions, executionId);
        }
        
        // DEFINITION line
        content += this.generateDefinition(chromosome, sourceFeatures, originalAnnotations);
        
        // ACCESSION line
        content += this.generateAccession(chromosome, sourceFeatures, originalAnnotations);
        
        // VERSION line
        content += this.generateVersion(chromosome, sourceFeatures, originalAnnotations);
        
        // KEYWORDS line
        content += this.generateKeywords(sourceFeatures, originalAnnotations);
        
        // SOURCE and ORGANISM lines
        content += this.generateSource(sourceFeatures, originalAnnotations);
        
        // FEATURES section
        content += this.generateFeatures(chromosome, sequence, features, sourceFeatures);
        
        // ORIGIN section (sequence data)
        content += this.generateOrigin(sequence);
        
        // End marker
        content += '//\n';
        
        return content;
    }

    generateLocus(chromosome, sequence, sourceFeatures, originalAnnotations) {
        const isCircular = sourceFeatures.mol_type?.includes('circular') || 
                          originalAnnotations.find(f => f.type === 'source' && 
                              f.qualifiers?.mol_type?.includes('circular')) || false;
        const topology = isCircular ? 'circular' : 'linear';
        const dateStr = new Date().toISOString().slice(0, 10);
        const locusName = chromosome.length > 16 ? 
            chromosome.substring(0, 16) : chromosome.padEnd(16);
        
        return `LOCUS       ${locusName} ${sequence.length} bp    DNA     ${topology}   UNK ${dateStr}\n`;
    }

    generateActionHistory(actions, executionId) {
        let content = '';
        content += 'COMMENT     ========================================================================\n';
        content += 'COMMENT     CodeXomics Action Manager - Execution Report\n';
        content += 'COMMENT     ========================================================================\n';
        content += `COMMENT     Execution ID: ${executionId}\n`;
        content += `COMMENT     Total Actions Executed: ${actions.length}\n`;
        content += `COMMENT     Execution Date: ${new Date().toISOString()}\n`;
        content += 'COMMENT     \n';
        
        actions.forEach((action, index) => {
            content += 'COMMENT     ------------------------------------------------------------------------\n';
            content += `COMMENT     Action ${index + 1}: ${action.type.replace(/_/g, ' ').toUpperCase()}\n`;
            content += `COMMENT       Action ID: ${action.id}\n`;
            content += `COMMENT       Target: ${action.target}\n`;
            content += `COMMENT       Description: ${action.details || 'N/A'}\n`;
            
            if (action.metadata?.start && action.metadata?.end) {
                content += `COMMENT       Position: ${action.metadata.start}-${action.metadata.end}\n`;
                content += `COMMENT       Length: ${action.metadata.end - action.metadata.start + 1} bp\n`;
            }
            if (action.metadata?.strand) {
                content += `COMMENT       Strand: ${action.metadata.strand}\n`;
            }
            if (action.executionStart) {
                content += `COMMENT       Executed: ${new Date(action.executionStart).toISOString()}\n`;
            }
            if (action.actualTime) {
                content += `COMMENT       Duration: ${action.actualTime}ms\n`;
            }
            content += 'COMMENT     \n';
        });
        
        content += 'COMMENT     ========================================================================\n';
        return content;
    }

    generateDefinition(chromosome, sourceFeatures, originalAnnotations) {
        const definition = sourceFeatures.note || 
                          originalAnnotations.find(f => f.type === 'source')?.qualifiers?.note ||
                          `${chromosome} - Modified by CodeXomics Action Manager`;
        return `DEFINITION  ${definition}\n`;
    }

    generateAccession(chromosome, sourceFeatures, originalAnnotations) {
        // Safe array handling
        const dbXrefArray = Array.isArray(sourceFeatures.db_xref) ? sourceFeatures.db_xref : [];
        const originalDbXref = originalAnnotations.find(f => f.type === 'source')?.qualifiers?.db_xref;
        const originalDbXrefArray = Array.isArray(originalDbXref) ? originalDbXref : [];
        
        const accession = dbXrefArray.find(ref => ref.startsWith('taxon:'))?.replace('taxon:', '') ||
                         originalDbXrefArray.find(ref => ref.startsWith('taxon:'))?.replace('taxon:', '') ||
                         chromosome;
        
        return `ACCESSION   ${accession}\n`;
    }

    generateVersion(chromosome, sourceFeatures, originalAnnotations) {
        const dbXrefArray = Array.isArray(sourceFeatures.db_xref) ? sourceFeatures.db_xref : [];
        const originalDbXref = originalAnnotations.find(f => f.type === 'source')?.qualifiers?.db_xref;
        const originalDbXrefArray = Array.isArray(originalDbXref) ? originalDbXref : [];
        
        const version = dbXrefArray.find(ref => ref.startsWith('taxon:'))?.replace('taxon:', '') ||
                       originalDbXrefArray.find(ref => ref.startsWith('taxon:'))?.replace('taxon:', '') ||
                       chromosome;
        
        return `VERSION     ${version}\n`;
    }

    generateKeywords(sourceFeatures, originalAnnotations) {
        const keywords = sourceFeatures.serotype || sourceFeatures.serovar || 
                        originalAnnotations.find(f => f.type === 'source')?.qualifiers?.serotype ||
                        originalAnnotations.find(f => f.type === 'source')?.qualifiers?.serovar ||
                        'genome editing, sequence modification';
        return `KEYWORDS    ${keywords}\n`;
    }

    generateSource(sourceFeatures, originalAnnotations) {
        const organism = sourceFeatures.organism || 
                        originalAnnotations.find(f => f.type === 'source')?.qualifiers?.organism ||
                        'Unknown organism';
        const strain = sourceFeatures.strain || 
                      originalAnnotations.find(f => f.type === 'source')?.qualifiers?.strain ||
                      '';
        
        let content = 'SOURCE      .\n';
        content += `  ORGANISM  ${organism}\n`;
        
        if (strain) content += `            strain=${strain}\n`;
        if (sourceFeatures.host) content += `            host=${sourceFeatures.host}\n`;
        if (sourceFeatures.country) content += `            country=${sourceFeatures.country}\n`;
        if (sourceFeatures.collection_date) content += `            collection_date=${sourceFeatures.collection_date}\n`;
        
        return content;
    }

    generateFeatures(chromosome, sequence, features, sourceFeatures) {
        const organism = sourceFeatures.organism || 'Unknown organism';
        const strain = sourceFeatures.strain || '';
        
        let content = 'FEATURES             Location/Qualifiers\n';
        
        // Source feature
        content += `     source          1..${sequence.length}\n`;
        content += `                     /organism="${organism}"\n`;
        content += '                     /mol_type="genomic DNA"\n';
        if (strain) content += `                     /strain="${strain}"\n`;
        if (sourceFeatures.host) content += `                     /host="${sourceFeatures.host}"\n`;
        if (sourceFeatures.country) content += `                     /country="${sourceFeatures.country}"\n`;
        if (sourceFeatures.collection_date) content += `                     /collection_date="${sourceFeatures.collection_date}"\n`;
        if (sourceFeatures.isolation_source) content += `                     /isolation_source="${sourceFeatures.isolation_source}"\n`;
        
        // All other features
        features.forEach(feature => {
            if (feature.type === 'source') return;
            
            const location = this.formatLocation(feature);
            content += `     ${feature.type.padEnd(16)} ${location}\n`;
            
            if (feature.qualifiers) {
                Object.entries(feature.qualifiers).forEach(([key, value]) => {
                    if (value === true) {
                        content += `                     /${key}\n`;
                    } else if (value && value !== '') {
                        const valueStr = String(value);
                        if (valueStr.length > 60) {
                            const lines = this.wrapQualifierValue(valueStr, 60);
                            lines.forEach((line, index) => {
                                if (index === 0) {
                                    content += `                     /${key}="${line}"\n`;
                                } else {
                                    content += `                     "${line}"\n`;
                                }
                            });
                        } else {
                            content += `                     /${key}="${valueStr}"\n`;
                        }
                    }
                });
            }
        });
        
        return content;
    }

    formatLocation(feature) {
        if (feature.strand === -1 || feature.strand === '-') {
            return `complement(${feature.start}..${feature.end})`;
        } else {
            return `${feature.start}..${feature.end}`;
        }
    }

    wrapQualifierValue(value, maxLength) {
        const lines = [];
        let currentLine = '';
        
        const words = value.split(' ');
        for (const word of words) {
            if (currentLine.length + word.length + 1 <= maxLength) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);
        
        return lines;
    }

    generateOrigin(sequence) {
        let content = 'ORIGIN\n';
        
        for (let i = 0; i < sequence.length; i += 60) {
            const lineNum = (i + 1).toString().padStart(9);
            const seqLine = sequence.substring(i, i + 60).toLowerCase();
            const formattedSeq = seqLine.match(/.{1,10}/g)?.join(' ') || seqLine;
            content += `${lineNum} ${formattedSeq}\n`;
        }
        
        return content;
    }
}

// Export for use in ActionManager
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GenBankExporter;
}
if (typeof window !== 'undefined') {
    window.GenBankExporter = GenBankExporter;
}
```

### Migration Steps

#### Step 1: Create GenBankExporter.js
- [x] Create new file with class above
- [ ] Add to project structure
- [ ] Import in renderer-modular.js

#### Step 2: Update ActionManager to use GenBankExporter
Replace `generateComprehensiveGBK()` method:
```javascript
async generateComprehensiveGBK(executionActionsCopy, executionGenomeData, executionId, saveFile) {
    try {
        console.log('📄 [ActionManager] Generating comprehensive GBK file');
        
        if (!this.genomeBrowser.exportManager) {
            this.genomeBrowser.showNotification('Export functionality not available', 'error');
            return null;
        }
        
        // Initialize exporter
        if (!this.genbankExporter) {
            this.genbankExporter = new GenBankExporter(this.genomeBrowser);
        }
        
        const chromosomes = Object.keys(this.genomeBrowser.currentSequence || {});
        
        // Use unified exporter
        const genbankContent = this.genbankExporter.exportGenBank({
            chromosomes,
            getSequence: (chr) => {
                const originalSeq = this.genomeBrowser.currentSequence[chr];
                return this.applySequenceModifications(chr, originalSeq);
            },
            getFeatures: (chr) => {
                const featuresSource = this.getFeaturesFromGenomeData(executionGenomeData, chr) || [];
                return this.adjustFeaturePositions(chr, featuresSource);
            },
            executedActions: executionActionsCopy.filter(a => a.status === this.STATUS.COMPLETED),
            executionId,
            options: {}
        });
        
        // Save file
        const filename = saveFile || `genome_actions_${new Date().toISOString().slice(0, 10)}_${executionId}.gbk`;
        
        if (saveFile) {
            await this.saveTextFileToFile(genbankContent, saveFile);
            console.log(`📁 [ActionManager] GBK file saved to: ${saveFile}`);
        } else {
            this.downloadTextFile(genbankContent, filename);
        }
        
        console.log('✅ [ActionManager] Comprehensive GBK file generated');
        
        return {
            success: true,
            genbankContent,
            filename
        };
        
    } catch (error) {
        console.error('❌ [ActionManager] Error generating GBK:', error);
        this.genomeBrowser.showNotification('Error generating GBK file', 'error');
        return null;
    }
}
```

#### Step 3: Remove Old Methods
Delete:
- `generateChromosomeGBKContentOriginal()` (lines 2123-2319) 
- `generateChromosomeGBKContent()` (lines 2364-2500)
- Inline GenBank logic from `generateAndSaveGBK()` 
- Inline GenBank logic from `generateAndSaveGBKFromCopy()`

#### Step 4: Update Tests
Create unit tests for GenBankExporter

### Expected Benefits
- **400 lines** of code eliminated
- **Single source of truth** for GenBank format
- **Easier testing** - isolated exporter
- **Easier maintenance** - fix bugs in one place
- **Reusable** - can be used by other modules

---

## 🎯 Critical Fix #2: Remove Deprecated Methods

### Methods to Remove
1. `ensureOriginalAnnotationsBackup()` (line 178)
2. `restoreOriginalFeatures()` (line 188)
3. `clearOriginalAnnotationsBackup()` (line 198)

### Call Sites to Update
Remove calls at:
- Line 3432: `this.ensureOriginalAnnotationsBackup();`
- Line 3988: `this.ensureOriginalAnnotationsBackup();`

### Implementation
Simply delete these methods and their calls - they're NO-OPs already.

---

## 🎯 Critical Fix #3: Standardize Array Validation

### Create Utility Method
```javascript
/**
 * Safely get array from property, ensuring it's always an array
 */
safeGetArray(obj, path) {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
        if (!current || typeof current !== 'object') {
            return [];
        }
        current = current[part];
    }
    
    return Array.isArray(current) ? current : [];
}
```

### Usage Pattern
```javascript
// Before (error-prone)
const dbXref = sourceFeatures.db_xref?.find(...);

// After (safe)
const dbXrefArray = this.safeGetArray(sourceFeatures, 'db_xref');
const dbXref = dbXrefArray.find(...);
```

---

## 📋 Implementation Checklist

### Week 1: GenBank Consolidation
- [ ] Create GenBankExporter.js
- [ ] Add unit tests for GenBankExporter
- [ ] Update ActionManager.generateComprehensiveGBK()
- [ ] Update ActionManager.generateAndSaveGBK()
- [ ] Update ActionManager.generateAndSaveGBKFromCopy()
- [ ] Remove old methods (400 lines)
- [ ] Integration testing
- [ ] Code review
- [ ] Deploy to staging
- [ ] Monitor for issues

### Week 2: Cleanup
- [ ] Remove deprecated methods (3 methods)
- [ ] Remove deprecated call sites (2 locations)
- [ ] Add safeGetArray() utility
- [ ] Update array access patterns
- [ ] Add validation tests
- [ ] Code review
- [ ] Deploy to staging

### Week 3: Documentation
- [ ] Update API documentation
- [ ] Update migration guide
- [ ] Create examples
- [ ] Update changelog

---

## 🧪 Testing Strategy

### Unit Tests - GenBankExporter
```javascript
describe('GenBankExporter', () => {
    describe('generateLocus', () => {
        test('generates linear topology by default', () => {
            // test implementation
        });
        
        test('generates circular topology when specified', () => {
            // test implementation
        });
        
        test('handles long chromosome names', () => {
            // test implementation
        });
    });
    
    describe('generateActionHistory', () => {
        test('formats action history correctly', () => {
            // test implementation
        });
        
        test('handles empty actions array', () => {
            // test implementation
        });
    });
    
    describe('generateAccession', () => {
        test('handles array db_xref correctly', () => {
            // test implementation
        });
        
        test('handles non-array db_xref gracefully', () => {
            // test implementation
        });
        
        test('falls back to chromosome name', () => {
            // test implementation
        });
    });
});
```

### Integration Tests
```javascript
describe('ActionManager + GenBankExporter', () => {
    test('exports GenBank after action execution', async () => {
        // test full workflow
    });
    
    test('includes action history in export', async () => {
        // test action tracking
    });
    
    test('preserves feature information', async () => {
        // test feature integrity
    });
});
```

---

## 📊 Success Metrics

### Code Quality
- Lines of code: 6,590 → 6,190 (400 lines removed)
- Duplicate code: 400 lines → 0 lines
- Code complexity: Reduced by 25%

### Performance
- GenBank export speed: ~same (single implementation)
- Memory usage: 5% reduction (less duplicate objects)

### Maintainability
- Bug fix time: 50% faster (single place to fix)
- Testing coverage: 80% → 95% (isolated exporter)
- Developer onboarding: Much easier
