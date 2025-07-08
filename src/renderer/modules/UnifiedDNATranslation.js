/**
 * Unified DNA Translation Implementation
 * 
 * This module provides a standardized DNA translation function that unifies
 * all 8 inconsistent implementations across the Genome AI Studio codebase.
 * 
 * Key improvements:
 * - Standardized genetic code table
 * - Consistent parameter handling
 * - Proper frame and strand processing
 * - Comprehensive error handling
 * - Detailed result metadata
 */

class UnifiedDNATranslation {
    
    /**
     * Get genetic code table by name
     * 
     * @param {string} geneticCode - Genetic code name
     * @returns {Object} Genetic code table
     */
    static getGeneticCodeTable(geneticCode = 'standard') {
        const standardCode = {
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

        const mitochondrialCode = {
            'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
            'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
            'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*',
            'TGT': 'C', 'TGC': 'C', 'TGA': 'W', 'TGG': 'W', // TGA = Trp in mitochondria
            'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
            'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
            'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
            'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
            'ATT': 'I', 'ATC': 'I', 'ATA': 'M', 'ATG': 'M', // ATA = Met in mitochondria
            'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
            'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
            'AGT': 'S', 'AGC': 'S', 'AGA': '*', 'AGG': '*', // AGA/AGG = stop in mitochondria
            'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
            'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
            'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
            'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
        };

        const geneticCodes = {
            'standard': standardCode,
            'mitochondrial': mitochondrialCode
        };

        return geneticCodes[geneticCode] || standardCode;
    }

    /**
     * Main unified DNA translation function
     * 
     * @param {Object} parameters - Translation parameters
     * @param {string} parameters.sequence - DNA sequence to translate
     * @param {number} parameters.frame - Reading frame (0, 1, or 2, default: 0)
     * @param {number} parameters.strand - Strand direction (1 for forward, -1 for reverse, default: 1)
     * @param {string} parameters.geneticCode - Genetic code to use ('standard' or 'mitochondrial', default: 'standard')
     * @param {boolean} parameters.includeStops - Whether to include stop codons in output (default: false)
     * @param {number} parameters.minLength - Minimum protein length (default: 0)
     * @param {boolean} parameters.validateInput - Whether to validate input sequence (default: true)
     * @param {Object} context - Execution context (optional)
     * @returns {Object} Translation result with metadata
     */
    static translateDNA(parameters, context = {}) {
        const {
            sequence,
            frame = 0,
            strand = 1,
            geneticCode = 'standard',
            includeStops = false,
            minLength = 0,
            validateInput = true
        } = parameters;

        try {
            // Input validation
            if (validateInput) {
                this.validateInput(sequence, frame, strand);
            }

            // Get genetic code table
            const codonTable = this.getGeneticCodeTable(geneticCode);

            // Process sequence
            let processedSequence = sequence.toUpperCase();
            
            // Handle strand direction
            if (strand === -1) {
                processedSequence = this.reverseComplement(processedSequence);
            }

            // Apply reading frame
            const startPosition = frame % 3;
            const frameSequence = processedSequence.slice(startPosition);

            // Translate sequence
            const translationResult = this.performTranslation(frameSequence, codonTable, includeStops);

            // Validate minimum length
            if (minLength > 0 && translationResult.protein.length < minLength) {
                return {
                    success: false,
                    error: `Protein length ${translationResult.protein.length} below minimum ${minLength}`,
                    protein: '',
                    codons: [],
                    metadata: {
                        originalSequence: sequence,
                        processedSequence,
                        frame,
                        strand,
                        geneticCode,
                        minLength,
                        calculatedAt: Date.now()
                    }
                };
            }

            return {
                success: true,
                protein: translationResult.protein,
                codons: translationResult.codons,
                length: translationResult.protein.length,
                frame,
                strand,
                geneticCode,
                metadata: {
                    originalSequence: sequence,
                    processedSequence,
                    frameSequence,
                    startPosition,
                    totalCodons: translationResult.codons.length,
                    stopCodons: translationResult.stopCodons,
                    calculatedAt: Date.now()
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                protein: '',
                codons: [],
                metadata: {
                    originalSequence: sequence,
                    frame,
                    strand,
                    geneticCode,
                    error: error.message,
                    calculatedAt: Date.now()
                }
            };
        }
    }

    /**
     * Perform the actual translation
     * 
     * @param {string} sequence - DNA sequence to translate
     * @param {Object} codonTable - Genetic code table
     * @param {boolean} includeStops - Whether to include stop codons
     * @returns {Object} Translation result
     */
    static performTranslation(sequence, codonTable, includeStops) {
        let protein = '';
        const codons = [];
        let stopCodons = 0;

        for (let i = 0; i < sequence.length - 2; i += 3) {
            const codon = sequence.substring(i, i + 3);
            
            if (codon.length === 3) {
                const aminoAcid = codonTable[codon] || 'X';
                
                codons.push({
                    position: i,
                    codon,
                    aminoAcid,
                    isStop: aminoAcid === '*'
                });

                if (aminoAcid === '*') {
                    stopCodons++;
                    if (!includeStops) {
                        break;
                    }
                }

                protein += aminoAcid;
            }
        }

        return {
            protein,
            codons,
            stopCodons
        };
    }

    /**
     * Validate input parameters
     * 
     * @param {string} sequence - DNA sequence
     * @param {number} frame - Reading frame
     * @param {number} strand - Strand direction
     * @throws {Error} If validation fails
     */
    static validateInput(sequence, frame, strand) {
        if (!sequence || typeof sequence !== 'string') {
            throw new Error('Sequence must be a non-empty string');
        }

        if (sequence.length < 3) {
            throw new Error('Sequence must be at least 3 nucleotides long');
        }

        if (!/^[ATGCRYSWKMBDHVN]*$/i.test(sequence)) {
            throw new Error('Sequence contains invalid characters. Only A, T, G, C, and ambiguous bases (R, Y, S, W, K, M, B, D, H, V, N) are allowed');
        }

        if (frame < 0 || frame > 2) {
            throw new Error('Frame must be 0, 1, or 2');
        }

        if (strand !== 1 && strand !== -1) {
            throw new Error('Strand must be 1 (forward) or -1 (reverse)');
        }
    }

    /**
     * Reverse complement DNA sequence
     * 
     * @param {string} sequence - DNA sequence
     * @returns {string} Reverse complement sequence
     */
    static reverseComplement(sequence) {
        const complement = {
            'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G',
            'R': 'Y', 'Y': 'R', 'S': 'S', 'W': 'W',
            'K': 'M', 'M': 'K', 'B': 'V', 'V': 'B',
            'D': 'H', 'H': 'D', 'N': 'N'
        };

        return sequence
            .split('')
            .reverse()
            .map(base => complement[base.toUpperCase()] || base)
            .join('');
    }

    /**
     * Get available genetic codes
     * 
     * @returns {Object} Available genetic codes
     */
    static getAvailableGeneticCodes() {
        return [
            {
                name: 'standard',
                description: 'Standard genetic code (most organisms)',
                codonCount: 64
            },
            {
                name: 'mitochondrial',
                description: 'Mitochondrial genetic code (vertebrates)',
                codonCount: 64
            }
        ];
    }

    /**
     * Analyze codon usage in a sequence
     * 
     * @param {string} sequence - DNA sequence
     * @param {string} geneticCode - Genetic code to use
     * @returns {Object} Codon usage analysis
     */
    static analyzeCodonUsage(sequence, geneticCode = 'standard') {
        const codonTable = this.getGeneticCodeTable(geneticCode);
        const codonCounts = {};
        const sequenceUpper = sequence.toUpperCase();

        for (let i = 0; i < sequenceUpper.length - 2; i += 3) {
            const codon = sequenceUpper.substring(i, i + 3);
            if (codon.length === 3 && !/N/.test(codon)) {
                codonCounts[codon] = (codonCounts[codon] || 0) + 1;
            }
        }

        const totalCodons = Object.values(codonCounts).reduce((a, b) => a + b, 0);
        const codonFrequencies = {};
        
        for (const [codon, count] of Object.entries(codonCounts)) {
            codonFrequencies[codon] = count / totalCodons;
        }

        return {
            counts: codonCounts,
            frequencies: codonFrequencies,
            total: totalCodons,
            geneticCode
        };
    }

    /**
     * Compatibility wrapper for old function signatures
     * 
     * @param {string} sequence - DNA sequence
     * @param {number} frame - Reading frame (legacy parameter)
     * @returns {string} Translated protein sequence
     */
    static legacyTranslateDNA(sequence, frame = 0) {
        const result = this.translateDNA({
            sequence,
            frame,
            strand: 1,
            geneticCode: 'standard',
            includeStops: false,
            validateInput: true
        });

        return result.success ? result.protein : '';
    }

    /**
     * Compatibility wrapper for strand-based translation
     * 
     * @param {string} sequence - DNA sequence
     * @param {number} strand - Strand direction (1 or -1)
     * @returns {string} Translated protein sequence
     */
    static strandBasedTranslateDNA(sequence, strand = 1) {
        const result = this.translateDNA({
            sequence,
            frame: 0,
            strand,
            geneticCode: 'standard',
            includeStops: false,
            validateInput: true
        });

        return result.success ? result.protein : '';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UnifiedDNATranslation;
}

// Make available globally for backward compatibility
if (typeof window !== 'undefined') {
    window.UnifiedDNATranslation = UnifiedDNATranslation;
} 