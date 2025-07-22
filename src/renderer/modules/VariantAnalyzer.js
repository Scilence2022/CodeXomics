/**
 * VariantAnalyzer - Advanced analysis of VCF variants including impact prediction
 */
class VariantAnalyzer {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.geneticCode = this.initializeGeneticCode();
    }

    /**
     * Initialize the genetic code table
     */
    initializeGeneticCode() {
        return {
            'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
            'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
            'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*',
            'TGT': 'C', 'TGC': 'C', 'TGA': '*', 'TGG': 'W',
            'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
            'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
            'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
            'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
            'ATT': 'I', 'ATC': 'I', 'ATA': 'I', 'ATG': 'M',
            'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
            'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
            'AGT': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
            'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
            'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
            'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
            'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
        };
    }

    /**
     * Get amino acid name from single letter code
     */
    getAminoAcidName(code) {
        const aminoAcidNames = {
            'A': 'Alanine', 'R': 'Arginine', 'N': 'Asparagine', 'D': 'Aspartic Acid',
            'C': 'Cysteine', 'E': 'Glutamic Acid', 'Q': 'Glutamine', 'G': 'Glycine',
            'H': 'Histidine', 'I': 'Isoleucine', 'L': 'Leucine', 'K': 'Lysine',
            'M': 'Methionine', 'F': 'Phenylalanine', 'P': 'Proline', 'S': 'Serine',
            'T': 'Threonine', 'W': 'Tryptophan', 'Y': 'Tyrosine', 'V': 'Valine',
            '*': 'Stop Codon'
        };
        return aminoAcidNames[code] || 'Unknown';
    }

    /**
     * Comprehensive variant analysis
     */
    async analyzeVariant(variant) {
        try {
            console.log('Analyzing variant:', variant);

            const analysis = {
                basicInfo: this.getBasicVariantInfo(variant),
                location: await this.getVariantLocation(variant),
                type: this.classifyVariantType(variant),
                impact: null,
                affectedGenes: []
            };

            // Get affected genes/features
            analysis.affectedGenes = await this.getAffectedGenes(variant);

            // Analyze impact for each affected gene
            for (const gene of analysis.affectedGenes) {
                if (gene.type === 'CDS' || gene.type === 'gene') {
                    const geneImpact = await this.analyzeGeneImpact(variant, gene);
                    gene.impact = geneImpact;

                    // Set overall impact to highest severity found
                    if (!analysis.impact || this.compareSeverity(geneImpact.severity, analysis.impact.severity) > 0) {
                        analysis.impact = geneImpact;
                    }
                }
            }

            // If no CDS impact, provide general genomic impact
            if (!analysis.impact) {
                analysis.impact = this.getGenomicImpact(variant, analysis.type);
            }

            console.log('Variant analysis complete:', analysis);
            return analysis;

        } catch (error) {
            console.error('Error analyzing variant:', error);
            return {
                basicInfo: this.getBasicVariantInfo(variant),
                location: { region: 'Unknown', description: 'Analysis failed' },
                type: this.classifyVariantType(variant),
                impact: { 
                    severity: 'Unknown', 
                    description: `Analysis failed: ${error.message}`,
                    details: []
                },
                affectedGenes: [],
                error: error.message
            };
        }
    }

    /**
     * Get basic variant information
     */
    getBasicVariantInfo(variant) {
        return {
            position: `${variant.chromosome}:${variant.start + 1}`, // Convert to 1-based
            reference: variant.ref,
            alternative: variant.alt,
            quality: variant.quality || 'Not specified',
            filter: variant.filter || 'Not specified',
            id: variant.id || 'Not specified'
        };
    }

    /**
     * Classify variant type
     */
    classifyVariantType(variant) {
        const refLen = variant.ref.length;
        const altLen = variant.alt.length;

        if (refLen === altLen && refLen === 1) {
            return {
                type: 'SNV',
                description: 'Single Nucleotide Variant',
                lengthChange: 0
            };
        } else if (refLen === altLen && refLen > 1) {
            return {
                type: 'MNV',
                description: 'Multiple Nucleotide Variant',
                lengthChange: 0
            };
        } else if (altLen > refLen) {
            return {
                type: 'Insertion',
                description: 'Insertion',
                lengthChange: altLen - refLen
            };
        } else if (altLen < refLen) {
            return {
                type: 'Deletion',
                description: 'Deletion',
                lengthChange: altLen - refLen
            };
        } else {
            return {
                type: 'Complex',
                description: 'Complex Structural Variant',
                lengthChange: altLen - refLen
            };
        }
    }

    /**
     * Get variant genomic location context
     */
    async getVariantLocation(variant) {
        try {
            // Check if variant is in any annotated features
            const chromosome = variant.chromosome;
            const position = variant.start;

            if (this.genomeBrowser.currentAnnotations && this.genomeBrowser.currentAnnotations[chromosome]) {
                const annotations = this.genomeBrowser.currentAnnotations[chromosome];
                const overlappingFeatures = annotations.filter(feature => 
                    position >= feature.start && position <= feature.end
                );

                if (overlappingFeatures.length > 0) {
                    const primaryFeature = overlappingFeatures[0];
                    return {
                        region: primaryFeature.type,
                        description: `Within ${primaryFeature.type}: ${primaryFeature.qualifiers?.gene || primaryFeature.qualifiers?.locus_tag || 'Unknown'}`,
                        features: overlappingFeatures
                    };
                }
            }

            return {
                region: 'Intergenic',
                description: 'Located in intergenic region',
                features: []
            };

        } catch (error) {
            console.error('Error getting variant location:', error);
            return {
                region: 'Unknown',
                description: 'Could not determine location',
                features: []
            };
        }
    }

    /**
     * Get affected genes/features
     */
    async getAffectedGenes(variant) {
        const affectedGenes = [];

        try {
            const chromosome = variant.chromosome;
            const varStart = variant.start;
            const varEnd = variant.end;

            if (this.genomeBrowser.currentAnnotations && this.genomeBrowser.currentAnnotations[chromosome]) {
                const annotations = this.genomeBrowser.currentAnnotations[chromosome];
                
                // Find all overlapping features
                const overlappingFeatures = annotations.filter(feature => {
                    return (varStart >= feature.start && varStart <= feature.end) ||
                           (varEnd >= feature.start && varEnd <= feature.end) ||
                           (varStart <= feature.start && varEnd >= feature.end);
                });

                for (const feature of overlappingFeatures) {
                    affectedGenes.push({
                        ...feature,
                        overlapType: this.getOverlapType(variant, feature)
                    });
                }
            }

        } catch (error) {
            console.error('Error getting affected genes:', error);
        }

        return affectedGenes;
    }

    /**
     * Determine overlap type between variant and feature
     */
    getOverlapType(variant, feature) {
        const varStart = variant.start;
        const varEnd = variant.end;
        const featStart = feature.start;
        const featEnd = feature.end;

        if (varStart >= featStart && varEnd <= featEnd) {
            return 'within';
        } else if (varStart <= featStart && varEnd >= featEnd) {
            return 'encompasses';
        } else if (varStart < featStart && varEnd >= featStart) {
            return 'upstream_overlap';
        } else if (varStart <= featEnd && varEnd > featEnd) {
            return 'downstream_overlap';
        } else {
            return 'adjacent';
        }
    }

    /**
     * Analyze impact on specific gene
     */
    async analyzeGeneImpact(variant, gene) {
        try {
            const chromosome = variant.chromosome;
            const variantPos = variant.start; // 0-based position
            const geneStart = gene.start;
            const geneEnd = gene.end;
            const strand = gene.strand || '+';

            // Get gene sequence
            const geneSequence = await this.genomeBrowser.getSequenceForRegion(
                chromosome, geneStart, geneEnd
            );

            if (!geneSequence) {
                throw new Error('Could not retrieve gene sequence');
            }

            // Calculate relative position within gene
            const relativePos = variantPos - geneStart;
            
            // Handle strand orientation
            let workingSequence = geneSequence;
            let workingRelativePos = relativePos;

            if (strand === '-') {
                workingSequence = this.reverseComplement(geneSequence);
                workingRelativePos = geneSequence.length - relativePos - 1;
            }

            // Apply variant to sequence
            const mutatedSequence = this.applyVariantToSequence(
                workingSequence, workingRelativePos, variant.ref, variant.alt
            );

            // Analyze protein impact if this is a CDS
            if (gene.type === 'CDS') {
                return await this.analyzeCDSImpact(
                    workingSequence, mutatedSequence, workingRelativePos, variant, gene
                );
            } else {
                return this.analyzeNonCodingImpact(variant, gene);
            }

        } catch (error) {
            console.error('Error analyzing gene impact:', error);
            return {
                severity: 'Unknown',
                description: `Analysis failed: ${error.message}`,
                details: []
            };
        }
    }

    /**
     * Apply variant to DNA sequence
     */
    applyVariantToSequence(sequence, position, ref, alt) {
        if (position < 0 || position >= sequence.length) {
            throw new Error('Variant position outside sequence bounds');
        }

        // Verify reference matches
        const actualRef = sequence.substr(position, ref.length);
        if (actualRef.toUpperCase() !== ref.toUpperCase()) {
            console.warn(`Reference mismatch at position ${position}: expected ${ref}, found ${actualRef}`);
        }

        // Apply the change
        return sequence.substring(0, position) + alt + sequence.substring(position + ref.length);
    }

    /**
     * Analyze impact on CDS (protein-coding sequence)
     */
    async analyzeCDSImpact(originalSeq, mutatedSeq, variantPos, variant, gene) {
        const details = [];
        let severity = 'Unknown';
        let description = '';

        try {
            // Find reading frame (variant position relative to start of CDS)
            const codonPosition = Math.floor(variantPos / 3);
            const codonOffset = variantPos % 3;
            const lengthChange = variant.alt.length - variant.ref.length;

            // Translate original and mutated sequences
            const originalProtein = this.translateDNA(originalSeq);
            const mutatedProtein = this.translateDNA(mutatedSeq);

            details.push(`Original sequence length: ${originalSeq.length} bp`);
            details.push(`Mutated sequence length: ${mutatedSeq.length} bp`);
            details.push(`Variant at codon ${codonPosition + 1}, position ${codonOffset + 1} in codon`);

            // Analyze impact type
            if (lengthChange % 3 !== 0) {
                // Frameshift mutation
                severity = 'High';
                description = 'Frameshift mutation';
                details.push('⚠️ FRAMESHIFT: Length change not divisible by 3');
                
                // Check for premature stop
                const stopIndex = mutatedProtein.indexOf('*');
                const originalStopIndex = originalProtein.indexOf('*');
                
                if (stopIndex !== -1 && stopIndex < originalStopIndex) {
                    details.push(`⚠️ PREMATURE STOP: Stop codon introduced at position ${stopIndex + 1}`);
                    severity = 'High';
                }

            } else if (lengthChange === 0) {
                // Point mutation or MNV
                if (codonPosition < originalProtein.length && codonPosition < mutatedProtein.length) {
                    const originalAA = originalProtein[codonPosition];
                    const mutatedAA = mutatedProtein[codonPosition];

                    if (originalAA !== mutatedAA) {
                        if (mutatedAA === '*') {
                            severity = 'High';
                            description = 'Nonsense mutation (creates stop codon)';
                            details.push(`⚠️ NONSENSE: ${originalAA} → ${mutatedAA} (${this.getAminoAcidName(originalAA)} → Stop)`);
                        } else if (originalAA === '*') {
                            severity = 'High';
                            description = 'Stop codon loss';
                            details.push(`⚠️ STOP LOSS: ${originalAA} → ${mutatedAA} (Stop → ${this.getAminoAcidName(mutatedAA)})`);
                        } else {
                            severity = 'Moderate';
                            description = 'Missense mutation';
                            details.push(`🔄 MISSENSE: ${originalAA} → ${mutatedAA} (${this.getAminoAcidName(originalAA)} → ${this.getAminoAcidName(mutatedAA)})`);
                        }
                    } else {
                        severity = 'Low';
                        description = 'Synonymous mutation';
                        details.push(`✅ SYNONYMOUS: ${originalAA} (${this.getAminoAcidName(originalAA)}) unchanged`);
                    }
                }

            } else {
                // In-frame insertion/deletion
                severity = 'Moderate';
                if (lengthChange > 0) {
                    description = 'In-frame insertion';
                    details.push(`📈 IN-FRAME INSERTION: ${lengthChange} nucleotides added`);
                } else {
                    description = 'In-frame deletion';
                    details.push(`📉 IN-FRAME DELETION: ${Math.abs(lengthChange)} nucleotides removed`);
                }
            }

            // Add codon change details
            if (codonPosition < Math.floor(originalSeq.length / 3)) {
                const originalCodonStart = codonPosition * 3;
                const originalCodon = originalSeq.substr(originalCodonStart, 3);
                
                let mutatedCodon = '';
                if (codonPosition < Math.floor(mutatedSeq.length / 3)) {
                    mutatedCodon = mutatedSeq.substr(originalCodonStart, 3);
                }

                if (originalCodon && mutatedCodon) {
                    details.push(`Codon change: ${originalCodon} → ${mutatedCodon}`);
                }
            }

            // Add gene information
            const geneName = gene.qualifiers?.gene || gene.qualifiers?.locus_tag || 'Unknown';
            const product = gene.qualifiers?.product || 'Unknown protein';
            details.push(`Gene: ${geneName}`);
            details.push(`Product: ${product}`);

        } catch (error) {
            console.error('Error in CDS impact analysis:', error);
            severity = 'Unknown';
            description = `CDS analysis failed: ${error.message}`;
            details.push(`Error: ${error.message}`);
        }

        return {
            severity,
            description,
            details,
            type: 'CDS'
        };
    }

    /**
     * Analyze impact on non-coding features
     */
    analyzeNonCodingImpact(variant, gene) {
        const details = [];
        let severity = 'Low';
        let description = 'Non-coding variant';

        const geneName = gene.qualifiers?.gene || gene.qualifiers?.locus_tag || 'Unknown';
        const featureType = gene.type || 'Unknown';

        details.push(`Feature: ${geneName} (${featureType})`);

        switch (featureType.toLowerCase()) {
            case 'rrna':
                severity = 'Moderate';
                description = 'rRNA gene variant';
                details.push('May affect ribosomal function');
                break;
            case 'trna':
                severity = 'Moderate';
                description = 'tRNA gene variant';
                details.push('May affect translation');
                break;
            case 'regulatory':
            case 'promoter':
                severity = 'Moderate';
                description = 'Regulatory region variant';
                details.push('May affect gene expression');
                break;
            default:
                severity = 'Low';
                description = `${featureType} variant`;
                details.push('Impact on non-coding element');
        }

        return {
            severity,
            description,
            details,
            type: featureType
        };
    }

    /**
     * Get genomic impact for variants not in annotated features
     */
    getGenomicImpact(variant, variantType) {
        return {
            severity: 'Low',
            description: `Intergenic ${variantType.description.toLowerCase()}`,
            details: [
                'Variant located in intergenic region',
                'Unlikely to have direct protein impact',
                'May affect regulatory elements'
            ],
            type: 'Intergenic'
        };
    }

    /**
     * Translate DNA sequence to protein
     */
    translateDNA(dnaSequence) {
        let protein = '';
        
        for (let i = 0; i < dnaSequence.length - 2; i += 3) {
            const codon = dnaSequence.substr(i, 3).toUpperCase();
            const aminoAcid = this.geneticCode[codon] || 'X';
            protein += aminoAcid;
            
            // Stop at first stop codon
            if (aminoAcid === '*') {
                break;
            }
        }
        
        return protein;
    }

    /**
     * Get reverse complement of DNA sequence
     */
    reverseComplement(sequence) {
        const complement = {
            'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G',
            'a': 't', 't': 'a', 'g': 'c', 'c': 'g',
            'N': 'N', 'n': 'n'
        };
        
        return sequence
            .split('')
            .reverse()
            .map(base => complement[base] || base)
            .join('');
    }

    /**
     * Compare severity levels
     */
    compareSeverity(severity1, severity2) {
        const severityLevels = {
            'Low': 1,
            'Moderate': 2,
            'High': 3,
            'Unknown': 0
        };
        
        return (severityLevels[severity1] || 0) - (severityLevels[severity2] || 0);
    }

    /**
     * Generate detailed HTML report for variant analysis
     */
    generateVariantReport(analysis) {
        const { basicInfo, location, type, impact, affectedGenes } = analysis;

        let html = `
            <div class="variant-analysis-report">
                <div class="variant-basic-info">
                    <h4>📍 Basic Information</h4>
                    <div class="info-grid">
                        <div><strong>Position:</strong> ${basicInfo.position}</div>
                        <div><strong>Reference:</strong> ${basicInfo.reference}</div>
                        <div><strong>Alternative:</strong> ${basicInfo.alternative}</div>
                        <div><strong>Quality:</strong> ${basicInfo.quality}</div>
                        <div><strong>Type:</strong> ${type.description}</div>
                    </div>
                </div>

                <div class="variant-location">
                    <h4>🎯 Genomic Location</h4>
                    <p><strong>Region:</strong> ${location.region}</p>
                    <p>${location.description}</p>
                </div>

                <div class="variant-impact">
                    <h4>⚡ Predicted Impact</h4>
                    <div class="impact-summary ${impact.severity.toLowerCase()}">
                        <div class="impact-severity">
                            <span class="severity-badge ${impact.severity.toLowerCase()}">${impact.severity}</span>
                            <span class="impact-description">${impact.description}</span>
                        </div>
                    </div>
                    <div class="impact-details">
                        ${impact.details.map(detail => `<div class="impact-detail">${detail}</div>`).join('')}
                    </div>
                </div>
        `;

        if (affectedGenes.length > 0) {
            html += `
                <div class="affected-genes">
                    <h4>🧬 Affected Genes/Features (${affectedGenes.length})</h4>
                    <div class="genes-list">
            `;

            for (const gene of affectedGenes) {
                const geneName = gene.qualifiers?.gene || gene.qualifiers?.locus_tag || 'Unknown';
                const product = gene.qualifiers?.product || '';
                
                html += `
                    <div class="gene-item">
                        <div class="gene-header">
                            <strong>${geneName}</strong> 
                            <span class="gene-type">${gene.type}</span>
                        </div>
                        ${product ? `<div class="gene-product">${product}</div>` : ''}
                        <div class="gene-position">${gene.start}-${gene.end} (${gene.strand || '+'})</div>
                `;

                if (gene.impact) {
                    html += `
                        <div class="gene-impact">
                            <span class="severity-badge ${gene.impact.severity.toLowerCase()}">${gene.impact.severity}</span>
                            <span>${gene.impact.description}</span>
                        </div>
                    `;
                }

                html += `</div>`;
            }

            html += `
                    </div>
                </div>
            `;
        }

        html += `</div>`;

        return html;
    }
}

// Make VariantAnalyzer globally available
window.VariantAnalyzer = VariantAnalyzer;