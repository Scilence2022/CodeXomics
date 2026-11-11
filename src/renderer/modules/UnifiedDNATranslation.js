/**
 * Unified DNA Translation Implementation
 *
 * This module provides a standardized DNA translation function that unifies
 * all 8 inconsistent implementations across the CodeXomics codebase.
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
   * The shared NCBI genetic code tables (see GeneticCodes.js).
   */
  static getGeneticCodes() {
    return typeof module !== 'undefined' && module.exports ? require('./GeneticCodes') : window.GeneticCodes;
  }

  /**
   * Get the codon-to-residue map of a genetic code.
   *
   * @param {number|string} geneticCode - NCBI translation table id or name
   * @returns {Object} Codon table
   * @throws {Error} If the genetic code is not known
   */
  static getGeneticCodeTable(geneticCode = 'standard') {
    return this.getGeneticCodes().require(geneticCode).codons;
  }

  /**
   * Main unified DNA translation function
   *
   * @param {Object} parameters - Translation parameters
   * @param {string} parameters.sequence - DNA sequence to translate
   * @param {number} parameters.frame - Reading frame (0, 1, or 2, default: 0)
   * @param {number} parameters.strand - Strand direction (1 for forward, -1 for reverse, default: 1)
   * @param {number|string} parameters.geneticCode - NCBI translation table id or name, such as 11,
   *   'standard', 'bacterial' or 'vertebrate_mitochondrial' (default: 'standard'). An unknown code is an
   *   error; it never falls back to the standard code.
   * @param {boolean} parameters.includeStops - Whether to include stop codons in output (default: false)
   * @param {boolean} parameters.cds - Treat the frame as a complete coding sequence: a first codon that is
   *   an initiation codon of the table (GTG or TTG in bacteria) is translated as Met (default: false)
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
      cds = false,
      minLength = 0,
      validateInput = true,
    } = parameters;

    try {
      // Input validation
      if (validateInput) {
        this.validateInput(sequence, frame, strand);
      }

      // Resolve the genetic code; an unknown code throws instead of silently
      // translating with the standard table.
      const codonTable = this.getGeneticCodes().require(geneticCode);

      // Process sequence. RNA input is read as its DNA equivalent.
      let processedSequence = sequence.toUpperCase().replace(/U/g, 'T');

      // Handle strand direction
      if (strand === -1) {
        processedSequence = this.reverseComplement(processedSequence);
      }

      // Apply reading frame
      const startPosition = frame % 3;
      const frameSequence = processedSequence.slice(startPosition);

      // Translate sequence
      const translationResult = this.performTranslation(frameSequence, codonTable, includeStops, { cds });

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
            calculatedAt: Date.now(),
          },
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
        translationTable: codonTable.id,
        metadata: {
          originalSequence: sequence,
          processedSequence,
          frameSequence,
          geneticCodeName: codonTable.name,
          startPosition,
          totalCodons: translationResult.codons.length,
          stopCodons: translationResult.stopCodons,
          calculatedAt: Date.now(),
        },
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
          calculatedAt: Date.now(),
        },
      };
    }
  }

  /**
   * Perform the actual translation
   *
   * @param {string} sequence - DNA sequence to translate
   * @param {Object} codonTable - Genetic code entry from GeneticCodes, or a plain codon-to-residue map
   * @param {boolean} includeStops - Whether to include stop codons
   * @param {Object} options - Translation options
   * @param {boolean} options.cds - Translate an initiation codon in first position as Met
   * @returns {Object} Translation result
   */
  static performTranslation(sequence, codonTable, includeStops, options = {}) {
    const geneticCodes = this.getGeneticCodes();
    const table = codonTable && codonTable.codons ? codonTable : { codons: codonTable, startCodons: [] };
    let protein = '';
    const codons = [];
    let stopCodons = 0;

    for (let i = 0; i < sequence.length - 2; i += 3) {
      const codon = sequence.substring(i, i + 3);

      if (codon.length === 3) {
        const aminoAcid =
          i === 0 && options.cds && geneticCodes.isStartCodon(codon, table)
            ? 'M'
            : geneticCodes.translateCodon(codon, table);

        codons.push({
          position: i,
          codon,
          aminoAcid,
          isStop: aminoAcid === '*',
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
      stopCodons,
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

    if (!/^[ATUGCRYSWKMBDHVN]*$/i.test(sequence)) {
      throw new Error(
        'Sequence contains invalid characters. Only A, T, U, G, C, and ambiguous bases (R, Y, S, W, K, M, B, D, H, V, N) are allowed'
      );
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
    const processing =
      typeof module !== 'undefined' && module.exports
        ? require('./UnifiedSequenceProcessing')
        : window.UnifiedSequenceProcessing;
    return processing.legacyReverseComplement(sequence);
  }

  /**
   * Get available genetic codes
   *
   * @returns {Object} Available genetic codes
   */
  static getAvailableGeneticCodes() {
    return this.getGeneticCodes()
      .list()
      .map(table => ({
        id: table.id,
        name: table.id === 1 ? 'standard' : `table_${table.id}`,
        description: table.name,
        codonCount: 64,
        startCodons: table.startCodons,
        stopCodons: table.stopCodons,
      }));
  }

  /**
   * Analyze codon usage in a sequence
   *
   * @param {string} sequence - DNA sequence
   * @param {string} geneticCode - Genetic code to use
   * @returns {Object} Codon usage analysis
   */
  static analyzeCodonUsage(sequence, geneticCode = 'standard') {
    this.getGeneticCodeTable(geneticCode);
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
      geneticCode,
    };
  }

  /**
   * Compatibility wrapper for old function signatures
   *
   * @param {string} sequence - DNA sequence
   * @param {number} frame - Reading frame (legacy parameter)
   * @returns {string} Translated protein sequence
   */
  static legacyTranslateDNA(sequence, frame = 0, options = {}) {
    const result = this.translateDNA({
      sequence,
      frame,
      strand: 1,
      geneticCode: options.geneticCode ?? 'standard',
      includeStops: options.includeStops ?? true,
      validateInput: false,
    });

    // An explicitly requested genetic code that cannot be honoured is an
    // error the caller must see; other failures keep the legacy empty result.
    if (!result.success && options.geneticCode !== undefined && !this.getGeneticCodes().resolve(options.geneticCode)) {
      throw new Error(result.error);
    }
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
      validateInput: true,
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
