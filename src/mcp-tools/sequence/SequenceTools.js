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

            find_orfs: {
                name: 'find_orfs',
                description: 'Find Open Reading Frames (ORFs) in DNA sequence',
                parameters: {
                    type: 'object',
                    properties: {
                        dna: { type: 'string', description: 'DNA sequence' },
                        minLength: { type: 'number', description: 'Minimum ORF length in codons', default: 30 },
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

            predict_promoter: {
                name: 'predict_promoter',
                description: 'Predict promoter regions in DNA sequence',
                parameters: {
                    type: 'object',
                    properties: {
                        seq: { type: 'string', description: 'DNA sequence to analyze' },
                        motif: { type: 'string', description: 'Promoter motif pattern (optional)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['seq']
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

    findORFs(dna, minLength = 30) {
        const startCodon = 'ATG';
        const stopCodons = ['TAA', 'TAG', 'TGA'];
        const orfs = [];
        
        // Check all 6 reading frames (3 forward, 3 reverse)
        for (let frame = 0; frame < 3; frame++) {
            // Forward strand
            const forwardORFs = this.findORFsInStrand(dna, frame, minLength, '+');
            orfs.push(...forwardORFs);
            
            // Reverse strand
            const reverseDNA = this.reverseComplement(dna);
            const reverseORFs = this.findORFsInStrand(reverseDNA, frame, minLength, '-');
            orfs.push(...reverseORFs);
        }
        
        return orfs.sort((a, b) => b.length - a.length);
    }

    findORFsInStrand(dna, frame, minLength, strand) {
        const sequence = dna.toUpperCase().slice(frame);
        const orfs = [];
        let start = -1;
        
        for (let i = 0; i < sequence.length - 2; i += 3) {
            const codon = sequence.slice(i, i + 3);
            
            if (codon === 'ATG' && start === -1) {
                start = i;
            } else if (['TAA', 'TAG', 'TGA'].includes(codon) && start !== -1) {
                const length = (i - start + 3) / 3;
                if (length >= minLength) {
                    orfs.push({
                        start: start + frame + 1,
                        end: i + frame + 3,
                        length: length,
                        strand: strand,
                        frame: frame + 1,
                        sequence: sequence.slice(start, i + 3)
                    });
                }
                start = -1;
            }
        }
        
        return orfs;
    }
}

module.exports = SequenceTools; 