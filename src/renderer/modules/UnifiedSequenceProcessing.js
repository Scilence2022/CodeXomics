/**
 * Unified Sequence Processing Implementation
 *
 * This module provides standardized implementations for common sequence processing
 * functions that unifies redundant implementations across the CodeXomics codebase.
 *
 * Key improvements:
 * - Standardized reverse complement with comprehensive ambiguous base support
 * - Consistent GC content calculation with proper validation
 * - Unified gene search with multiple search strategies
 * - Comprehensive error handling and input validation
 * - Detailed result metadata for debugging
 */

class UnifiedSequenceProcessing {
  static calculateMolecularWeight(sequence, type = 'auto') {
    if (!sequence || typeof sequence !== 'string') return 0;

    // Clean sequence (remove whitespace, numbers, hyphens)
    const cleanSeq = sequence
      .trim()
      .toUpperCase()
      .replace(/[\s\d-]/g, '');
    if (cleanSeq.length === 0) return 0;

    let detectedType = type;
    if (type === 'auto') {
      // Heuristic: If it contains only standard DNA/RNA characters (A, T, G, C, N, U), treat as DNA.
      // Else treat as protein.
      if (/^[ATGCNU]+$/.test(cleanSeq)) {
        detectedType = 'dna';
      } else {
        detectedType = 'protein';
      }
    }

    if (detectedType === 'dna' || detectedType === 'rna') {
      // DNA/RNA nucleotide weights (standard Average nucleotide weights in Da)
      // A=331.2, T=322.2, G=347.2, C=307.2, U=308.2, N=327.0 (average)
      const weights = { A: 331.2, T: 322.2, G: 347.2, C: 307.2, U: 308.2, N: 327.0 };
      let weight = 0;
      for (const base of cleanSeq) {
        weight += weights[base] || weights.N;
      }
      return weight - (cleanSeq.length - 1) * 18.01; // Subtract water molecules for phosphodiester bonds
    } else {
      // Protein average amino acid residue weights (Da)
      const weights = {
        A: 71.08,
        R: 156.19,
        N: 114.1,
        D: 115.09,
        C: 103.14,
        E: 129.12,
        Q: 128.13,
        G: 57.05,
        H: 137.14,
        I: 113.16,
        L: 113.16,
        K: 128.17,
        M: 131.2,
        F: 147.18,
        P: 97.12,
        S: 87.08,
        T: 101.11,
        W: 186.21,
        Y: 163.18,
        V: 99.13,
        U: 150.03,
        O: 237.3,
        '*': 0,
        X: 110.0,
      };
      let weight = 0;
      for (const aa of cleanSeq) {
        weight += weights[aa] ?? weights.X;
      }
      return weight + 18.02; // Add terminal water molecule (H2O)
    }
  }

  /**
   * Comprehensive reverse complement with ambiguous base support
   *
   * @param {string} sequence - DNA sequence to reverse complement
   * @param {Object} options - Processing options
   * @param {boolean} options.caseSensitive - Whether to preserve case (default: false)
   * @param {boolean} options.validateInput - Whether to validate input (default: true)
   * @param {boolean} options.handleAmbiguous - Whether to handle ambiguous bases (default: true)
   * @returns {Object} Reverse complement result with metadata
   */
  static reverseComplement(sequence, options = {}) {
    const { caseSensitive = false, validateInput = true, handleAmbiguous = true } = options;

    try {
      // Input validation
      if (validateInput) {
        this.validateSequence(sequence);
      }

      // Comprehensive complement table with ambiguous bases
      const complement = {
        A: 'T',
        T: 'A',
        G: 'C',
        C: 'G',
        R: 'Y',
        Y: 'R',
        S: 'S',
        W: 'W',
        K: 'M',
        M: 'K',
        B: 'V',
        V: 'B',
        D: 'H',
        H: 'D',
        N: 'N',
        a: 't',
        t: 'a',
        g: 'c',
        c: 'g',
        r: 'y',
        y: 'r',
        s: 's',
        w: 'w',
        k: 'm',
        m: 'k',
        b: 'v',
        v: 'b',
        d: 'h',
        h: 'd',
        n: 'n',
      };

      // Process sequence
      let processedSequence = sequence;
      if (!caseSensitive) {
        processedSequence = sequence.toUpperCase();
      }

      // Perform reverse complement
      const result = processedSequence
        .split('')
        .reverse()
        .map(base => {
          if (handleAmbiguous) {
            return complement[base] || base;
          } else {
            // Only handle standard bases
            return /[ATGC]/i.test(base) ? complement[base] : base;
          }
        })
        .join('');

      return {
        success: true,
        sequence: result,
        originalLength: sequence.length,
        processedLength: result.length,
        caseSensitive,
        handleAmbiguous,
        metadata: {
          originalSequence: sequence,
          processedSequence,
          ambiguousBases: this.countAmbiguousBases(sequence),
          standardBases: this.countStandardBases(sequence),
          calculatedAt: Date.now(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        sequence: '',
        metadata: {
          originalSequence: sequence,
          error: error.message,
          calculatedAt: Date.now(),
        },
      };
    }
  }

  /**
   * Calculate GC content with comprehensive validation
   *
   * @param {string} sequence - DNA sequence to analyze
   * @param {Object} options - Calculation options
   * @param {boolean} options.includeAmbiguous - Whether to include ambiguous bases in calculation
   * @param {boolean} options.validateInput - Whether to validate input (default: true)
   * @param {string} options.method - Calculation method ('standard', 'weighted', 'window')
   * @param {number} options.windowSize - Window size for sliding window calculation
   * @returns {Object} GC content result with detailed statistics
   */
  static computeGC(sequence, options = {}) {
    const { includeAmbiguous = false, validateInput = true, method = 'standard', windowSize = 100 } = options;

    try {
      // Input validation
      if (validateInput) {
        this.validateSequence(sequence);
      }

      const sequenceUpper = sequence.toUpperCase();
      let gcContent;
      let gcCount;
      let totalBases;
      let statistics;

      switch (method) {
        case 'standard': {
          const counts = new Uint32Array(128);
          for (let i = 0; i < sequenceUpper.length; i++) {
            counts[sequenceUpper.charCodeAt(i)]++;
          }
          statistics = this.summarizeStandardGC(counts, includeAmbiguous);
          gcContent = Number(statistics.gcContent);
          break;
        }

        case 'weighted': { // Weighted GC calculation considering ambiguous bases
          const baseCounts = this.countBases(sequenceUpper, includeAmbiguous);
          gcCount = baseCounts.g + baseCounts.c;
          totalBases = Object.values(baseCounts).reduce((a, b) => a + b, 0);
          gcContent = totalBases === 0 ? 0 : (gcCount / totalBases) * 100;

          statistics = {
            ...baseCounts,
            gcCount,
            totalBases,
            gcContent: gcContent.toFixed(2),
            method: 'weighted',
          };
          break;
        }

        case 'window': {
          const windows = [];
          const rolling = Number.isInteger(windowSize) && windowSize >= 0;
          const counts = new Uint32Array(128);
          if (rolling) {
            for (let i = 0; i < Math.min(windowSize, sequenceUpper.length); i++) {
              counts[sequenceUpper.charCodeAt(i)]++;
            }
          }

          let totalGC = 0;
          let minGC = Infinity;
          let maxGC = -Infinity;
          for (let i = 0; i <= sequenceUpper.length - windowSize; i++) {
            const window = sequenceUpper.substring(i, i + windowSize);
            let windowGC;
            if (rolling) {
              if (i > 0 && windowSize > 0) {
                counts[sequenceUpper.charCodeAt(i - 1)]--;
                counts[sequenceUpper.charCodeAt(i + windowSize - 1)]++;
              }
              windowGC = Number(this.summarizeStandardGC(counts, includeAmbiguous).gcContent);
            } else {
              windowGC = this.computeGC(window, {
                includeAmbiguous,
                validateInput: false,
                method: 'standard',
              }).gcContent;
            }
            windows.push({
              position: i + 1,
              end: i + windowSize,
              gcContent: windowGC,
              sequence: window,
            });
            totalGC += windowGC;
            minGC = Math.min(minGC, windowGC);
            maxGC = Math.max(maxGC, windowGC);
          }

          gcContent = totalGC / windows.length;
          statistics = {
            windowSize,
            windows: windows.length,
            averageGC: gcContent.toFixed(2),
            minGC: minGC.toFixed(2),
            maxGC: maxGC.toFixed(2),
            method: 'window',
            windowData: windows,
          };
          break;
        }

        default:
          throw new Error(`Unknown GC calculation method: ${method}`);
      }

      return {
        success: true,
        gcContent: parseFloat(gcContent.toFixed(2)),
        statistics,
        metadata: {
          sequenceLength: sequence.length,
          method,
          includeAmbiguous,
          calculatedAt: Date.now(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        gcContent: 0,
        statistics: {},
        metadata: {
          sequence: sequence,
          error: error.message,
          calculatedAt: Date.now(),
        },
      };
    }
  }

  static summarizeStandardGC(counts, includeAmbiguous) {
    const a = counts['A'.charCodeAt(0)];
    const c = counts['C'.charCodeAt(0)];
    const g = counts['G'.charCodeAt(0)];
    const t = counts['T'.charCodeAt(0)];
    let gcCount = g + c;
    let totalBases = g + c + a + t;

    if (includeAmbiguous) {
      const b = counts['B'.charCodeAt(0)];
      const d = counts['D'.charCodeAt(0)];
      const h = counts['H'.charCodeAt(0)];
      const k = counts['K'.charCodeAt(0)];
      const m = counts['M'.charCodeAt(0)];
      const n = counts['N'.charCodeAt(0)];
      const r = counts['R'.charCodeAt(0)];
      const s = counts['S'.charCodeAt(0)];
      const v = counts['V'.charCodeAt(0)];
      const w = counts['W'.charCodeAt(0)];
      const y = counts['Y'.charCodeAt(0)];
      gcCount = g + c + r * 0.5 + s * 0.5 + k * 0.5 + m * 0.5 + b * 0.33 + v * 0.67 + d * 0.33 + h * 0.33;
      totalBases += n + r + y + s + w + k + m + b + v + d + h;
    }

    const gcContent = totalBases === 0 ? 0 : (gcCount / totalBases) * 100;
    return { g, c, a, t, gcCount, totalBases, gcContent: gcContent.toFixed(2), method: 'standard' };
  }

  /**
   * Search for genes by name with multiple search strategies
   *
   * @param {string} query - Gene name or search query
   * @param {Object} options - Search options
   * @param {boolean} options.caseSensitive - Whether search is case sensitive (default: false)
   * @param {boolean} options.partialMatch - Whether to allow partial matches (default: true)
   * @param {boolean} options.fuzzyMatch - Whether to use fuzzy matching (default: false)
   * @param {number} options.maxResults - Maximum number of results (default: 10)
   * @param {string} options.chromosome - Specific chromosome to search (default: null)
   * @param {Array} options.searchFields - Fields to search in (default: ['gene', 'locus_tag', 'product', 'note'])
   * @returns {Object} Search result with detailed information
   */
  static searchGeneByName(query, options = {}) {
    const {
      caseSensitive = false,
      partialMatch = true,
      fuzzyMatch = false,
      maxResults = 10,
      chromosome = null,
      searchFields = ['gene', 'locus_tag', 'product', 'note'],
    } = options;

    try {
      // Input validation
      if (!query || typeof query !== 'string') {
        throw new Error('Query must be a non-empty string');
      }

      const gb = window.genomeBrowser;
      if (!gb) {
        throw new Error('GenomeBrowser not initialized');
      }

      const searchQuery = caseSensitive ? query : query.toLowerCase();
      const results = [];
      const chromosomes = chromosome ? [chromosome] : Object.keys(gb.currentAnnotations || {});

      // Search through all chromosomes
      for (const chr of chromosomes) {
        const features = gb.currentAnnotations[chr] || [];

        for (const feature of features) {
          const qualifiers = feature.qualifiers || {};
          let matchScore = 0;
          let matchedField = '';
          let matchedValue = '';

          // Search through specified fields
          for (const field of searchFields) {
            const raw = qualifiers[field];
            const values = Array.isArray(raw) ? raw : [raw];
            for (const value of values) {
              if (typeof value !== 'string' || !value) continue;

              const searchValue = caseSensitive ? value : value.toLowerCase();
              let score = 0;

              if (caseSensitive ? searchValue === searchQuery : searchValue === searchQuery) {
                // Exact match
                score = 100;
              } else if (partialMatch && searchValue.includes(searchQuery)) {
                // Partial match
                score = 50 + (searchQuery.length / searchValue.length) * 30;
              } else if (fuzzyMatch) {
                // Fuzzy match using Levenshtein distance
                const distance = this.levenshteinDistance(searchValue, searchQuery);
                const maxLength = Math.max(searchValue.length, searchQuery.length);
                score = Math.max(0, 100 - (distance / maxLength) * 100);
              }

              if (score > matchScore) {
                matchScore = score;
                matchedField = field;
                matchedValue = value;
              }
            }
          }

          // Add result if score meets threshold
          if (matchScore > 0) {
            results.push({
              chromosome: chr,
              feature: feature,
              score: matchScore,
              matchedField,
              matchedValue,
              searchQuery: query,
            });
          }
        }
      }

      // Sort by score and limit results
      results.sort((a, b) => b.score - a.score);
      const limitedResults = results.slice(0, maxResults);

      return {
        success: true,
        results: limitedResults,
        totalFound: results.length,
        returned: limitedResults.length,
        query: searchQuery,
        searchFields,
        metadata: {
          caseSensitive,
          partialMatch,
          fuzzyMatch,
          chromosomesSearched: chromosomes.length,
          calculatedAt: Date.now(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        results: [],
        totalFound: 0,
        metadata: {
          query: query,
          error: error.message,
          calculatedAt: Date.now(),
        },
      };
    }
  }

  /**
   * Validate DNA sequence input
   *
   * @param {string} sequence - DNA sequence to validate
   * @throws {Error} If validation fails
   */
  static validateSequence(sequence) {
    if (!sequence || typeof sequence !== 'string') {
      throw new Error('Sequence must be a non-empty string');
    }

    if (sequence.length === 0) {
      throw new Error('Sequence cannot be empty');
    }

    // Check for valid DNA characters (including ambiguous bases)
    if (!/^[ATGCRYSWKMBDHVN]*$/i.test(sequence)) {
      throw new Error(
        'Sequence contains invalid characters. Only A, T, G, C, and ambiguous bases (R, Y, S, W, K, M, B, D, H, V, N) are allowed'
      );
    }
  }

  /**
   * Count different types of bases in a sequence
   *
   * @param {string} sequence - DNA sequence
   * @param {boolean} includeAmbiguous - Whether to include ambiguous bases
   * @returns {Object} Base counts
   */
  static countBases(sequence, includeAmbiguous = false) {
    const counts = {
      A: 0,
      T: 0,
      G: 0,
      C: 0,
    };

    if (includeAmbiguous) {
      counts.N = 0;
      counts.R = 0;
      counts.Y = 0;
      counts.S = 0;
      counts.W = 0;
      counts.K = 0;
      counts.M = 0;
      counts.B = 0;
      counts.V = 0;
      counts.D = 0;
      counts.H = 0;
    }

    for (const base of sequence.toUpperCase()) {
      if (Object.prototype.hasOwnProperty.call(counts, base)) {
        counts[base]++;
      }
    }

    return counts;
  }

  /**
   * Count ambiguous bases in a sequence
   *
   * @param {string} sequence - DNA sequence
   * @returns {number} Number of ambiguous bases
   */
  static countAmbiguousBases(sequence) {
    return (sequence.match(/[RYSWKMBDHVN]/gi) || []).length;
  }

  /**
   * Count standard bases in a sequence
   *
   * @param {string} sequence - DNA sequence
   * @returns {number} Number of standard bases
   */
  static countStandardBases(sequence) {
    return (sequence.match(/[ATGC]/gi) || []).length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   *
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Levenshtein distance
   */
  static levenshteinDistance(str1, str2) {
    if (str1.length > str2.length) [str1, str2] = [str2, str1];

    // Keep the previous row in place, saving the diagonal before overwriting it.
    const distances = new Uint32Array(str1.length + 1);
    for (let j = 0; j < distances.length; j++) distances[j] = j;

    for (let i = 1; i <= str2.length; i++) {
      const charCode = str2.charCodeAt(i - 1);
      let diagonal = distances[0];
      distances[0] = i;
      for (let j = 1; j < distances.length; j++) {
        const above = distances[j];
        distances[j] = charCode === str1.charCodeAt(j - 1) ? diagonal : 1 + Math.min(diagonal, distances[j - 1], above);
        diagonal = above;
      }
    }

    return distances[str1.length];
  }

  /**
   * Compatibility wrapper for legacy reverseComplement function
   *
   * @param {string} sequence - DNA sequence
   * @returns {string} Reverse complement sequence
   */
  static legacyReverseComplement(sequence) {
    const result = this.reverseComplement(sequence, { validateInput: false });
    return result.success ? result.sequence : '';
  }

  /**
   * Compatibility wrapper for legacy computeGC function
   *
   * @param {string} sequence - DNA sequence
   * @returns {number} GC content percentage
   */
  static legacyComputeGC(sequence) {
    if (!sequence || typeof sequence !== 'string') return 0;
    const valid = (sequence.match(/[ATGC]/gi) || []).length;
    return valid ? ((sequence.match(/[GC]/gi) || []).length / valid) * 100 : 0;
  }

  /**
   * Compatibility wrapper for legacy searchGeneByName function
   *
   * @param {string} name - Gene name
   * @returns {Object|null} Gene result or null
   */
  static legacySearchGeneByName(name) {
    const result = this.searchGeneByName(name, { maxResults: 1 });
    return result.success && result.results.length > 0 ? result.results[0] : null;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UnifiedSequenceProcessing;
}

// Make available globally for backward compatibility
if (typeof window !== 'undefined') {
  window.UnifiedSequenceProcessing = UnifiedSequenceProcessing;
}
