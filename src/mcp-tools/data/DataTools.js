/**
 * Data Management Tools Module
 * Handles data annotation, export, and codon usage analysis
 */

class DataTools {
    constructor(server) {
        this.server = server;
    }

    getTools() {
        return {
            create_annotation: {
                name: 'create_annotation',
                description: 'Create a new user-defined annotation',
                parameters: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', description: 'Feature type (gene, CDS, rRNA, tRNA, etc.)' },
                        name: { type: 'string', description: 'Feature name' },
                        chromosome: { type: 'string', description: 'Chromosome' },
                        start: { type: 'number', description: 'Start position' },
                        end: { type: 'number', description: 'End position' },
                        strand: { type: 'number', description: 'Strand (1 for forward, -1 for reverse)' },
                        description: { type: 'string', description: 'Feature description' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['type', 'name', 'chromosome', 'start', 'end']
                }
            },

            analyze_region: {
                name: 'analyze_region',
                description: 'Analyze a genomic region and return features, GC content, etc.',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { type: 'string', description: 'Chromosome name' },
                        start: { type: 'number', description: 'Start position' },
                        end: { type: 'number', description: 'End position' },
                        includeFeatures: { type: 'boolean', description: 'Include gene/feature annotations' },
                        includeGC: { type: 'boolean', description: 'Include GC content analysis' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['chromosome', 'start', 'end']
                }
            },

            export_data: {
                name: 'export_data',
                description: 'Export sequence or annotation data',
                parameters: {
                    type: 'object',
                    properties: {
                        format: { type: 'string', description: 'Export format (fasta, genbank, gff, bed)' },
                        chromosome: { type: 'string', description: 'Chromosome (optional for full export)' },
                        start: { type: 'number', description: 'Start position (optional)' },
                        end: { type: 'number', description: 'End position (optional)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['format']
                }
            },

            codon_usage_analysis: {
                name: 'codon_usage_analysis',
                description: 'Analyze codon usage patterns in a DNA coding sequence',
                parameters: {
                    type: 'object',
                    properties: {
                        sequence: { type: 'string', description: 'DNA coding sequence to analyze' },
                        geneName: { type: 'string', description: 'Gene name for context (optional)' },
                        organism: { type: 'string', description: 'Organism name for comparison (optional)', default: 'E. coli' },
                        includeStatistics: { type: 'boolean', description: 'Include detailed statistics', default: true },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['sequence']
                }
            }
        };
    }

    async executeClientTool(toolName, parameters, clientId) {
        return await this.server.executeToolOnClient(toolName, parameters, clientId);
    }

    async analyzeCodonUsage(parameters) {
        return await this.server.analyzeCodonUsage(parameters);
    }

    calculateCodonBias(rscu) {
        return this.server.calculateCodonBias(rscu);
    }

    getOptimizationSuggestions(rscu, organism) {
        return this.server.getOptimizationSuggestions(rscu, organism);
    }

    calculateENC(codonCounts, aminoAcidCounts) {
        return this.server.calculateENC(codonCounts, aminoAcidCounts);
    }

    calculateCAI(sequence, organism) {
        return this.server.calculateCAI(sequence, organism);
    }

    identifyRareCodons(codonFrequencies, organism) {
        return this.server.identifyRareCodons(codonFrequencies, organism);
    }

    calculateGC3(sequence) {
        return this.server.calculateGC3(sequence);
    }

    // Codon usage analysis implementation
    analyzeCodonUsageLocal(sequence, geneName = null, organism = 'E. coli') {
        const codonTable = {
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

        const cleanSequence = sequence.replace(/[^ATCG]/gi, '').toUpperCase();
        const codonCounts = {};
        const aminoAcidCounts = {};
        
        // Count codons and amino acids
        for (let i = 0; i < cleanSequence.length - 2; i += 3) {
            const codon = cleanSequence.slice(i, i + 3);
            if (codon.length === 3) {
                const aa = codonTable[codon];
                if (aa) {
                    codonCounts[codon] = (codonCounts[codon] || 0) + 1;
                    aminoAcidCounts[aa] = (aminoAcidCounts[aa] || 0) + 1;
                }
            }
        }

        // Calculate RSCU (Relative Synonymous Codon Usage)
        const rscu = {};
        const synonymousCodons = this.getSynonymousCodons();
        
        for (const [aa, codons] of Object.entries(synonymousCodons)) {
            const totalAA = aminoAcidCounts[aa] || 0;
            if (totalAA > 0) {
                const expectedFreq = totalAA / codons.length;
                for (const codon of codons) {
                    const observedFreq = codonCounts[codon] || 0;
                    rscu[codon] = expectedFreq > 0 ? observedFreq / expectedFreq : 0;
                }
            }
        }

        // Calculate statistics
        const totalCodons = Object.values(codonCounts).reduce((sum, count) => sum + count, 0);
        const gcContent = this.calculateGCContent(cleanSequence);
        const gc3 = this.calculateGC3Content(cleanSequence);
        
        return {
            geneName: geneName || 'Unknown',
            organism: organism,
            sequenceLength: cleanSequence.length,
            totalCodons: totalCodons,
            uniqueCodons: Object.keys(codonCounts).length,
            gcContent: gcContent,
            gc3Content: gc3,
            codonCounts: codonCounts,
            aminoAcidCounts: aminoAcidCounts,
            rscu: rscu,
            codonFrequencies: this.calculateCodonFrequencies(codonCounts, totalCodons),
            bias: this.calculateCodonBiasLocal(rscu),
            rareCodons: this.identifyRareCodonsLocal(codonCounts, totalCodons),
            optimizationSuggestions: this.getOptimizationSuggestionsLocal(rscu, organism)
        };
    }

    getSynonymousCodons() {
        return {
            'F': ['TTT', 'TTC'],
            'L': ['TTA', 'TTG', 'CTT', 'CTC', 'CTA', 'CTG'],
            'S': ['TCT', 'TCC', 'TCA', 'TCG', 'AGT', 'AGC'],
            'Y': ['TAT', 'TAC'],
            'C': ['TGT', 'TGC'],
            'W': ['TGG'],
            'P': ['CCT', 'CCC', 'CCA', 'CCG'],
            'H': ['CAT', 'CAC'],
            'Q': ['CAA', 'CAG'],
            'R': ['CGT', 'CGC', 'CGA', 'CGG', 'AGA', 'AGG'],
            'I': ['ATT', 'ATC', 'ATA'],
            'M': ['ATG'],
            'T': ['ACT', 'ACC', 'ACA', 'ACG'],
            'N': ['AAT', 'AAC'],
            'K': ['AAA', 'AAG'],
            'V': ['GTT', 'GTC', 'GTA', 'GTG'],
            'A': ['GCT', 'GCC', 'GCA', 'GCG'],
            'D': ['GAT', 'GAC'],
            'E': ['GAA', 'GAG'],
            'G': ['GGT', 'GGC', 'GGA', 'GGG'],
            '*': ['TAA', 'TAG', 'TGA']
        };
    }

    calculateCodonFrequencies(codonCounts, totalCodons) {
        const frequencies = {};
        for (const [codon, count] of Object.entries(codonCounts)) {
            frequencies[codon] = (count / totalCodons * 1000).toFixed(2); // per 1000 codons
        }
        return frequencies;
    }

    calculateCodonBiasLocal(rscu) {
        const values = Object.values(rscu).filter(v => v > 0);
        if (values.length === 0) return 0;
        
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        
        return Math.sqrt(variance).toFixed(3);
    }

    identifyRareCodonsLocal(codonCounts, totalCodons, threshold = 0.005) {
        const rareCodons = [];
        for (const [codon, count] of Object.entries(codonCounts)) {
            const frequency = count / totalCodons;
            if (frequency < threshold) {
                rareCodons.push({
                    codon: codon,
                    count: count,
                    frequency: frequency.toFixed(4)
                });
            }
        }
        return rareCodons.sort((a, b) => a.frequency - b.frequency);
    }

    getOptimizationSuggestionsLocal(rscu, organism) {
        const suggestions = [];
        const preferredCodons = this.getPreferredCodons(organism);
        
        for (const [codon, rscuValue] of Object.entries(rscu)) {
            if (rscuValue < 0.3 && preferredCodons[codon]) {
                suggestions.push({
                    codon: codon,
                    rscu: rscuValue.toFixed(3),
                    suggestion: `Consider replacing ${codon} with ${preferredCodons[codon]}`,
                    reason: 'Low RSCU value indicates rare usage'
                });
            }
        }
        
        return suggestions;
    }

    getPreferredCodons(organism) {
        // E. coli preferred codons (simplified)
        const ecoliPreferred = {
            'TTA': 'CTG', 'CTA': 'CTG', 'CTC': 'CTG', 'CTT': 'CTG',
            'ATA': 'ATC', 'ATT': 'ATC',
            'GTA': 'GTG', 'GTC': 'GTG', 'GTT': 'GTG',
            'TCA': 'TCG', 'TCC': 'TCG', 'TCT': 'TCG', 'AGT': 'TCG', 'AGC': 'TCG',
            'CCA': 'CCG', 'CCC': 'CCG', 'CCT': 'CCG'
        };
        
        return organism.toLowerCase().includes('coli') ? ecoliPreferred : ecoliPreferred;
    }

    calculateGCContent(sequence) {
        if (!sequence || sequence.length === 0) return 0;
        const gcCount = (sequence.match(/[GC]/gi) || []).length;
        return ((gcCount / sequence.length) * 100).toFixed(2);
    }

    calculateGC3Content(sequence) {
        let gc3Count = 0;
        let total3rdPositions = 0;
        
        for (let i = 2; i < sequence.length; i += 3) {
            const nucleotide = sequence[i];
            if (nucleotide === 'G' || nucleotide === 'C') {
                gc3Count++;
            }
            total3rdPositions++;
        }
        
        return total3rdPositions > 0 ? ((gc3Count / total3rdPositions) * 100).toFixed(2) : 0;
    }
}

module.exports = DataTools; 