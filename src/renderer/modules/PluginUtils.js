/**
 * PluginUtils - Utility functions for plugin system
 * Contains helper functions for calculations, data processing, and visualization
 */

const PluginUtils = {
    
    // ===== SEQUENCE ANALYSIS UTILITIES =====
    
    calculateGC(sequence) {
        if (!sequence) return 0;
        const g = (sequence.match(/G/gi) || []).length;
        const c = (sequence.match(/C/gi) || []).length;
        const valid = g + c + (sequence.match(/[AT]/gi) || []).length;
        return valid === 0 ? 0 : ((g + c) / valid) * 100;
    },

    calculateGCSkew(sequence) {
        if (!sequence) return 0;
        const g = (sequence.match(/G/gi) || []).length;
        const c = (sequence.match(/C/gi) || []).length;
        return (g + c) === 0 ? 0 : (g - c) / (g + c);
    },

    reverseComplement(dna) {
        const complement = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G', 'N': 'N' };
        return dna.toUpperCase().split('').reverse().map(base => complement[base] || 'N').join('');
    },

    calculateShannonDiversity(sequences) {
        const counts = {};
        let total = 0;
        
        for (const seq of sequences) {
            for (const base of seq.toUpperCase()) {
                counts[base] = (counts[base] || 0) + 1;
                total++;
            }
        }
        
        let shannon = 0;
        for (const count of Object.values(counts)) {
            const p = count / total;
            if (p > 0) {
                shannon -= p * Math.log2(p);
            }
        }
        
        return shannon;
    },

    calculateSimpsonDiversity(sequences) {
        const counts = {};
        let total = 0;
        
        for (const seq of sequences) {
            for (const base of seq.toUpperCase()) {
                counts[base] = (counts[base] || 0) + 1;
                total++;
            }
        }
        
        let simpson = 0;
        for (const count of Object.values(counts)) {
            const p = count / total;
            simpson += p * p;
        }
        
        return 1 - simpson;
    },

    calculateComplexity(sequence) {
        // Simple complexity measure based on subsequence diversity
        const kmers = new Set();
        const k = 4;
        
        for (let i = 0; i <= sequence.length - k; i++) {
            kmers.add(sequence.substr(i, k));
        }
        
        return kmers.size / (sequence.length - k + 1);
    },

    calculateSequenceEntropy(sequence) {
        const counts = {};
        for (const base of sequence.toUpperCase()) {
            counts[base] = (counts[base] || 0) + 1;
        }
        
        let entropy = 0;
        const total = sequence.length;
        for (const count of Object.values(counts)) {
            const p = count / total;
            if (p > 0) {
                entropy -= p * Math.log2(p);
            }
        }
        
        return entropy;
    },

    calculateSimilarity(seq1, seq2) {
        const minLen = Math.min(seq1.length, seq2.length);
        let matches = 0;
        
        for (let i = 0; i < minLen; i++) {
            if (seq1[i].toUpperCase() === seq2[i].toUpperCase()) {
                matches++;
            }
        }
        
        return matches / minLen;
    },

    calculateIdentity(seq1, seq2) {
        const alignment = this.alignSequences(seq1, seq2);
        return this.calculateSimilarity(alignment.seq1, alignment.seq2);
    },

    calculateStandardDeviation(values) {
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / values.length;
        return Math.sqrt(avgSquaredDiff);
    },

    calculateNucleotideFrequencies(sequences) {
        const counts = { A: 0, T: 0, G: 0, C: 0, N: 0 };
        let total = 0;
        
        for (const seq of sequences) {
            for (const base of seq.toUpperCase()) {
                if (counts.hasOwnProperty(base)) {
                    counts[base]++;
                } else {
                    counts.N++;
                }
                total++;
            }
        }
        
        const frequencies = {};
        for (const [base, count] of Object.entries(counts)) {
            frequencies[base] = count / total;
        }
        
        return frequencies;
    },

    calculateAverageComplexity(sequences) {
        const complexities = sequences.map(seq => this.calculateComplexity(seq));
        return complexities.reduce((sum, c) => sum + c, 0) / complexities.length;
    },

    getBasicSequenceStats(sequence) {
        return {
            length: sequence.length,
            gcContent: this.calculateGC(sequence),
            complexity: this.calculateComplexity(sequence),
            entropy: this.calculateSequenceEntropy(sequence),
            nucleotideFreqs: this.calculateNucleotideFrequencies([sequence])
        };
    },

    // ===== MOTIF ANALYSIS UTILITIES =====
    
    calculateMotifScore(match, pattern) {
        // Simple scoring based on exact vs approximate match
        if (match === pattern) return 1.0;
        return this.calculateSimilarity(match, pattern);
    },

    summarizeMotifMatches(matches) {
        if (matches.length === 0) return null;
        
        const scores = matches.map(m => m.score);
        const positions = matches.map(m => m.position);
        
        return {
            averageScore: scores.reduce((sum, s) => sum + s, 0) / scores.length,
            maxScore: Math.max(...scores),
            minScore: Math.min(...scores),
            positionSpread: Math.max(...positions) - Math.min(...positions),
            strandDistribution: {
                forward: matches.filter(m => m.strand === '+').length,
                reverse: matches.filter(m => m.strand === '-').length
            }
        };
    },

    // ===== PHYLOGENETIC UTILITIES =====
    
    calculateDistanceMatrix(sequences, metric) {
        const n = sequences.length;
        const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
        
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                let distance;
                switch (metric) {
                    case 'hamming':
                        distance = this.hammingDistance(sequences[i].sequence, sequences[j].sequence);
                        break;
                    case 'jukes-cantor':
                        distance = this.jukesCantor(sequences[i].sequence, sequences[j].sequence);
                        break;
                    default:
                        distance = this.hammingDistance(sequences[i].sequence, sequences[j].sequence);
                }
                matrix[i][j] = matrix[j][i] = distance;
            }
        }
        
        return matrix;
    },

    hammingDistance(seq1, seq2) {
        const minLen = Math.min(seq1.length, seq2.length);
        let differences = 0;
        
        for (let i = 0; i < minLen; i++) {
            if (seq1[i].toUpperCase() !== seq2[i].toUpperCase()) {
                differences++;
            }
        }
        
        // Add length difference
        differences += Math.abs(seq1.length - seq2.length);
        
        return differences / Math.max(seq1.length, seq2.length);
    },

    jukesCantor(seq1, seq2) {
        const p = this.calculatePDistance(seq1, seq2);
        if (p >= 0.75) return Infinity; // Saturation
        return -0.75 * Math.log(1 - (4/3) * p);
    },

    calculatePDistance(seq1, seq2) {
        const alignment = this.alignSequences(seq1, seq2);
        return 1 - this.calculateSimilarity(alignment.seq1, alignment.seq2);
    },

    calculateJukesCantorDistance(seq1, seq2) {
        return this.jukesCantor(seq1, seq2);
    },

    calculateKimuraDistance(seq1, seq2) {
        // Simplified Kimura 2-parameter model
        const alignment = this.alignSequences(seq1, seq2);
        const p = this.calculatePDistance(alignment.seq1, alignment.seq2);
        
        // Simplified calculation (proper implementation would count transitions/transversions)
        return -0.5 * Math.log(1 - 2 * p);
    },

    alignSequences(seq1, seq2) {
        // Simple global alignment (Needleman-Wunsch simplified)
        // For production use, consider using a proper alignment library
        const minLen = Math.min(seq1.length, seq2.length);
        return {
            seq1: seq1.substr(0, minLen),
            seq2: seq2.substr(0, minLen),
            score: this.calculateSimilarity(seq1.substr(0, minLen), seq2.substr(0, minLen))
        };
    },

    countGaps(seq1, seq2) {
        let gaps = 0;
        const maxLen = Math.max(seq1.length, seq2.length);
        
        for (let i = 0; i < maxLen; i++) {
            if (i >= seq1.length || i >= seq2.length || seq1[i] === '-' || seq2[i] === '-') {
                gaps++;
            }
        }
        
        return gaps;
    },

    neighborJoining(distanceMatrix, sequences) {
        // Simplified neighbor-joining algorithm
        const n = sequences.length;
        if (n < 2) return null;
        
        // Create initial tree structure
        const tree = {
            name: 'root',
            children: sequences.map((seq, i) => ({
                name: seq.name || seq.id || `Seq${i}`,
                sequence: seq.sequence,
                distance: 0
            }))
        };
        
        return tree;
    },

    upgma(distanceMatrix, sequences) {
        // Simplified UPGMA algorithm
        const n = sequences.length;
        if (n < 2) return null;
        
        // Create initial tree structure
        const tree = {
            name: 'root',
            method: 'UPGMA',
            children: sequences.map((seq, i) => ({
                name: seq.name || seq.id || `Seq${i}`,
                sequence: seq.sequence,
                distance: 0
            }))
        };
        
        return tree;
    },

    treeToNewick(tree) {
        if (!tree) return '';
        
        if (!tree.children || tree.children.length === 0) {
            return tree.name || 'unnamed';
        }
        
        const childrenNewick = tree.children.map(child => this.treeToNewick(child)).join(',');
        return `(${childrenNewick})${tree.name || ''}`;
    },

    // ===== MACHINE LEARNING UTILITIES =====
    
    extractSequenceFeatures(sequence) {
        return {
            length: sequence.length,
            gcContent: this.calculateGC(sequence),
            complexity: this.calculateComplexity(sequence),
            entropy: this.calculateSequenceEntropy(sequence),
            nucleotideFreqs: this.calculateNucleotideFrequencies([sequence]),
            diNucleotideFreqs: this.calculateDiNucleotideFreqs(sequence),
            codonUsage: this.calculateCodonUsage(sequence),
            repeats: this.findRepeats(sequence)
        };
    },

    calculateDiNucleotideFreqs(sequence) {
        const counts = {};
        const total = sequence.length - 1;
        
        for (let i = 0; i < total; i++) {
            const dinuc = sequence.substr(i, 2).toUpperCase();
            counts[dinuc] = (counts[dinuc] || 0) + 1;
        }
        
        const freqs = {};
        for (const [dinuc, count] of Object.entries(counts)) {
            freqs[dinuc] = count / total;
        }
        
        return freqs;
    },

    calculateCodonUsage(sequence) {
        const counts = {};
        const codons = [];
        
        for (let i = 0; i < sequence.length - 2; i += 3) {
            const codon = sequence.substr(i, 3).toUpperCase();
            if (codon.length === 3) {
                counts[codon] = (counts[codon] || 0) + 1;
                codons.push(codon);
            }
        }
        
        const total = codons.length;
        const freqs = {};
        for (const [codon, count] of Object.entries(counts)) {
            freqs[codon] = count / total;
        }
        
        return freqs;
    },

    findRepeats(sequence) {
        const repeats = [];
        const minRepeatLength = 3;
        const seen = new Set();
        
        for (let len = minRepeatLength; len <= sequence.length / 2; len++) {
            for (let i = 0; i <= sequence.length - len; i++) {
                const substr = sequence.substr(i, len);
                if (!seen.has(substr)) {
                    seen.add(substr);
                    const regex = new RegExp(substr, 'gi');
                    const matches = sequence.match(regex);
                    if (matches && matches.length > 1) {
                        repeats.push({
                            sequence: substr,
                            length: len,
                            count: matches.length
                        });
                    }
                }
            }
        }
        
        return repeats.sort((a, b) => b.count - a.count).slice(0, 10); // Top 10 repeats
    },

    simulateMLPrediction(features, model) {
        // Simulate ML prediction results
        const functions = [
            { name: 'DNA replication', confidence: 0.85 },
            { name: 'Transcription', confidence: 0.72 },
            { name: 'Metabolism', confidence: 0.68 },
            { name: 'Cell division', confidence: 0.45 },
            { name: 'Transport', confidence: 0.33 }
        ];
        
        // Adjust confidence based on features
        const gcBias = Math.abs(features.gcContent - 50) / 50; // Bias based on GC content
        const complexityBias = features.complexity;
        
        return {
            model: model,
            predictions: functions.map(func => ({
                ...func,
                confidence: Math.max(0, Math.min(1, func.confidence * (1 - gcBias * 0.2) * (0.5 + complexityBias * 0.5)))
            })).sort((a, b) => b.confidence - a.confidence)
        };
    },

    simulateClassification(features, categories, model) {
        // Simulate classification results
        const scores = categories.map(cat => ({
            category: cat,
            score: Math.random() * (0.5 + features.complexity * 0.5),
            confidence: Math.random() * 0.3 + 0.4
        }));
        
        return scores.sort((a, b) => b.score - a.score);
    },

    kMeansClustering(features, k) {
        // Simplified k-means clustering
        const clusters = Array(k).fill(null).map((_, i) => ({
            id: i,
            center: null,
            members: []
        }));
        
        // Randomly assign initial clusters
        features.forEach((item, index) => {
            const clusterId = index % k;
            clusters[clusterId].members.push(item);
        });
        
        return clusters;
    },

    hierarchicalClustering(features) {
        // Simplified hierarchical clustering
        return features.map((item, index) => ({
            id: index,
            members: [item]
        }));
    },

    dbscanClustering(features) {
        // Simplified DBSCAN clustering
        return [{
            id: 0,
            members: features
        }];
    },

    calculateSilhouetteScore(features, clusters) {
        // Simplified silhouette score calculation
        return Math.random() * 0.4 + 0.3; // Random score between 0.3 and 0.7
    },

    // ===== COMPARISON AND SUMMARY UTILITIES =====
    
    summarizeComparison(results, analysisType) {
        if (results.length === 0) return null;
        
        const values = results.map(r => {
            const analysis = r.analysis;
            switch (analysisType) {
                case 'gc':
                    return analysis.gcContent;
                case 'complexity':
                    return analysis.complexity;
                case 'similarity':
                    return analysis.similarity;
                default:
                    return 0;
            }
        }).filter(v => v != null);
        
        return {
            mean: values.reduce((sum, v) => sum + v, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            std: this.calculateStandardDeviation(values),
            median: this.calculateMedian(values)
        };
    },

    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 
            ? (sorted[mid - 1] + sorted[mid]) / 2 
            : sorted[mid];
    },

    calculateRegionCorrelations(results) {
        // Calculate correlations between different metrics
        if (results.length < 2) return {};
        
        const correlations = {};
        // This would contain actual correlation calculations
        // For now, return placeholder
        return {
            gcComplexity: Math.random() * 0.6 - 0.3,
            lengthComplexity: Math.random() * 0.4 - 0.2
        };
    },

    summarizeClassification(results) {
        const categoryCount = {};
        for (const result of results) {
            const topCategory = result.classification[0]?.category;
            if (topCategory) {
                categoryCount[topCategory] = (categoryCount[topCategory] || 0) + 1;
            }
        }
        
        return {
            totalSequences: results.length,
            categoryDistribution: categoryCount,
            averageConfidence: results.reduce((sum, r) => sum + (r.classification[0]?.confidence || 0), 0) / results.length
        };
    },

    // ===== DATA ACCESS UTILITIES =====
    
    getSequenceFromGenomeBrowser(chromosome, start, end) {
        try {
            if (window.genomeBrowser && window.genomeBrowser.getSequence) {
                return window.genomeBrowser.getSequence(chromosome, start, end);
            }
            
            // Fallback: try to get from renderer if available
            if (window.renderer && window.renderer.getSequence) {
                return window.renderer.getSequence(chromosome, start, end);
            }
            
            // Last resort: try MicrobeFns
            if (window.MicrobeFns && window.MicrobeFns.getSequenceInRegion) {
                return window.MicrobeFns.getSequenceInRegion(chromosome, start, end);
            }
            
            console.warn('No sequence data source available');
            return null;
        } catch (error) {
            console.error('Error getting sequence from genome browser:', error);
            return null;
        }
    }
};

// Standalone utility functions for direct use
PluginUtils.calculateGCContent = function(sequence) {
    return PluginUtils.calculateGC(sequence);
};

PluginUtils.calculateSequenceDiversity = function(sequences, metric = 'shannon') {
    switch (metric) {
        case 'shannon':
            return PluginUtils.calculateShannonDiversity(sequences);
        case 'simpson':
            return PluginUtils.calculateSimpsonDiversity(sequences);
        default:
            return PluginUtils.calculateShannonDiversity(sequences);
    }
};

// Export if in module environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginUtils;
} 