/**
 * Unified Sequence Processing Implementation
 * 
 * This module provides standardized implementations for common sequence processing
 * functions that unifies redundant implementations across the Genome AI Studio codebase.
 * 
 * Key improvements:
 * - Standardized reverse complement with comprehensive ambiguous base support
 * - Consistent GC content calculation with proper validation
 * - Unified gene search with multiple search strategies
 * - Comprehensive error handling and input validation
 * - Detailed result metadata for debugging
 */

class UnifiedSequenceProcessing {
    
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
        const {
            caseSensitive = false,
            validateInput = true,
            handleAmbiguous = true
        } = options;

        try {
            // Input validation
            if (validateInput) {
                this.validateSequence(sequence);
            }

            // Comprehensive complement table with ambiguous bases
            const complement = {
                'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G',
                'R': 'Y', 'Y': 'R', 'S': 'S', 'W': 'W',
                'K': 'M', 'M': 'K', 'B': 'V', 'V': 'B',
                'D': 'H', 'H': 'D', 'N': 'N',
                'a': 't', 't': 'a', 'g': 'c', 'c': 'g',
                'r': 'y', 'y': 'r', 's': 's', 'w': 'w',
                'k': 'm', 'm': 'k', 'b': 'v', 'v': 'b',
                'd': 'h', 'h': 'd', 'n': 'n'
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
                        return complement[base] || (base.match(/[ATGC]/i) ? 'N' : base);
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
                    calculatedAt: Date.now()
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                sequence: '',
                metadata: {
                    originalSequence: sequence,
                    error: error.message,
                    calculatedAt: Date.now()
                }
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
        const {
            includeAmbiguous = false,
            validateInput = true,
            method = 'standard',
            windowSize = 100
        } = options;

        try {
            // Input validation
            if (validateInput) {
                this.validateSequence(sequence);
            }

            const sequenceUpper = sequence.toUpperCase();
            let gcContent, gcCount, totalBases, statistics;

            switch (method) {
                case 'standard':
                    // Standard GC calculation
                    const g = (sequenceUpper.match(/G/g) || []).length;
                    const c = (sequenceUpper.match(/C/g) || []).length;
                    const a = (sequenceUpper.match(/A/g) || []).length;
                    const t = (sequenceUpper.match(/T/g) || []).length;
                    
                    if (includeAmbiguous) {
                        const n = (sequenceUpper.match(/N/g) || []).length;
                        const r = (sequenceUpper.match(/R/g) || []).length;
                        const y = (sequenceUpper.match(/Y/g) || []).length;
                        const s = (sequenceUpper.match(/S/g) || []).length;
                        const w = (sequenceUpper.match(/W/g) || []).length;
                        const k = (sequenceUpper.match(/K/g) || []).length;
                        const m = (sequenceUpper.match(/M/g) || []).length;
                        const b = (sequenceUpper.match(/B/g) || []).length;
                        const v = (sequenceUpper.match(/V/g) || []).length;
                        const d = (sequenceUpper.match(/D/g) || []).length;
                        const h = (sequenceUpper.match(/H/g) || []).length;
                        
                        gcCount = g + c + (r * 0.5) + (s * 0.5) + (k * 0.5) + (m * 0.5) + (b * 0.33) + (v * 0.67) + (d * 0.33) + (h * 0.33);
                        totalBases = g + c + a + t + n + r + y + s + w + k + m + b + v + d + h;
                    } else {
                        gcCount = g + c;
                        totalBases = g + c + a + t;
                    }
                    
                    gcContent = totalBases === 0 ? 0 : (gcCount / totalBases) * 100;
                    
                    statistics = {
                        g: g, c: c, a: a, t: t,
                        gcCount, totalBases,
                        gcContent: gcContent.toFixed(2),
                        method: 'standard'
                    };
                    break;

                case 'weighted':
                    // Weighted GC calculation considering ambiguous bases
                    const baseCounts = this.countBases(sequenceUpper, includeAmbiguous);
                    gcCount = baseCounts.g + baseCounts.c;
                    totalBases = Object.values(baseCounts).reduce((a, b) => a + b, 0);
                    gcContent = totalBases === 0 ? 0 : (gcCount / totalBases) * 100;
                    
                    statistics = {
                        ...baseCounts,
                        gcCount, totalBases,
                        gcContent: gcContent.toFixed(2),
                        method: 'weighted'
                    };
                    break;

                case 'window':
                    // Sliding window GC calculation
                    const windows = [];
                    for (let i = 0; i <= sequenceUpper.length - windowSize; i++) {
                        const window = sequenceUpper.substring(i, i + windowSize);
                        const windowGC = this.computeGC(window, { includeAmbiguous, validateInput: false, method: 'standard' });
                        windows.push({
                            position: i + 1,
                            end: i + windowSize,
                            gcContent: windowGC.gcContent,
                            sequence: window
                        });
                    }
                    
                    const avgGC = windows.reduce((sum, w) => sum + parseFloat(w.gcContent), 0) / windows.length;
                    gcContent = avgGC;
                    
                    statistics = {
                        windowSize,
                        windows: windows.length,
                        averageGC: avgGC.toFixed(2),
                        minGC: Math.min(...windows.map(w => parseFloat(w.gcContent))).toFixed(2),
                        maxGC: Math.max(...windows.map(w => parseFloat(w.gcContent))).toFixed(2),
                        method: 'window',
                        windowData: windows
                    };
                    break;

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
                    calculatedAt: Date.now()
                }
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
                    calculatedAt: Date.now()
                }
            };
        }
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
            searchFields = ['gene', 'locus_tag', 'product', 'note']
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
                        const value = qualifiers[field];
                        if (!value) continue;

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

                    // Add result if score meets threshold
                    if (matchScore > 0) {
                        results.push({
                            chromosome: chr,
                            feature: feature,
                            score: matchScore,
                            matchedField,
                            matchedValue,
                            searchQuery: query
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
                    calculatedAt: Date.now()
                }
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
                    calculatedAt: Date.now()
                }
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
            throw new Error('Sequence contains invalid characters. Only A, T, G, C, and ambiguous bases (R, Y, S, W, K, M, B, D, H, V, N) are allowed');
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
            A: 0, T: 0, G: 0, C: 0
        };

        if (includeAmbiguous) {
            counts.N = 0; counts.R = 0; counts.Y = 0; counts.S = 0;
            counts.W = 0; counts.K = 0; counts.M = 0; counts.B = 0;
            counts.V = 0; counts.D = 0; counts.H = 0;
        }

        for (const base of sequence.toUpperCase()) {
            if (counts.hasOwnProperty(base)) {
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
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
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
        const result = this.computeGC(sequence, { validateInput: false });
        return result.success ? result.gcContent : 0;
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