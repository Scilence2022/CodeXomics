/**
 * Sequence Analysis Tools Module
 * Handles DNA/RNA sequence analysis, motif searching, and basic bioinformatics
 */

class SequenceTools {
    constructor(server) {
        this.server = server;
    }

    getTools() {
        return {
            get_sequence: {
                name: 'get_sequence',
                description: 'Get DNA sequence for a specific region',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { type: 'string', description: 'Chromosome name' },
                        start: { type: 'number', description: 'Start position' },
                        end: { type: 'number', description: 'End position' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['chromosome', 'start', 'end']
                }
            },

            compute_gc: {
                name: 'compute_gc',
                description: 'Calculate GC content percentage for a DNA sequence',
                parameters: {
                    type: 'object',
                    properties: {
                        sequence: { type: 'string', description: 'DNA sequence' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['sequence']
                }
            },

            translate_dna: {
                name: 'translate_dna',
                description: 'Translate DNA sequence to protein (amino acid sequence)',
                parameters: {
                    type: 'object',
                    properties: {
                        dna: { type: 'string', description: 'DNA sequence to translate' },
                        frame: { type: 'number', description: 'Reading frame (0, 1, or 2)', default: 0 },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['dna']
                }
            },

            reverse_complement: {
                name: 'reverse_complement',
                description: 'Get reverse complement of DNA sequence',
                parameters: {
                    type: 'object',
                    properties: {
                        dna: { type: 'string', description: 'DNA sequence' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['dna']
                }
            },

            search_sequence_motif: {
                name: 'search_sequence_motif',
                description: 'Search for sequence motifs in the genome',
                parameters: {
                    type: 'object',
                    properties: {
                        pattern: { type: 'string', description: 'Sequence motif pattern' },
                        chromosome: { type: 'string', description: 'Chromosome to search (optional)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['pattern']
                }
            },

            get_coding_sequence: {
                name: 'get_coding_sequence',
                description: 'Get the coding sequence (DNA) for a specific gene or locus tag',
                parameters: {
                    type: 'object',
                    properties: {
                        identifier: { type: 'string', description: 'Gene name or locus tag (e.g., b0062, araA)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['identifier']
                }
            }
        };
    }

    async executeClientTool(toolName, parameters, clientId) {
        return await this.server.executeToolOnClient(toolName, parameters, clientId);
    }

    async getCodingSequence(parameters, clientId) {
        return await this.server.getCodingSequence(parameters, clientId);
    }

    // Basic sequence analysis functions
    calculateGCContent(sequence) {
        if (!sequence || sequence.length === 0) return 0;
        
        const gcCount = (sequence.match(/[GC]/gi) || []).length;
        return ((gcCount / sequence.length) * 100).toFixed(2);
    }

    translateDNA(dna, frame = 0) {
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

        const sequence = dna.toUpperCase().slice(frame);
        let protein = '';
        
        for (let i = 0; i < sequence.length - 2; i += 3) {
            const codon = sequence.slice(i, i + 3);
            if (codon.length === 3) {
                protein += codonTable[codon] || 'X';
            }
        }
        
        return protein;
    }

    reverseComplement(dna) {
        const complement = {
            'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G',
            'a': 't', 't': 'a', 'g': 'c', 'c': 'g',
            'N': 'N', 'n': 'n'
        };
        
        return dna.split('').reverse().map(base => complement[base] || base).join('');
    }
}

module.exports = SequenceTools;