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
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['chromosome', 'start', 'end'],
        },
      },

      compute_gc: {
        name: 'compute_gc',
        description: 'Calculate GC content percentage for a DNA sequence',
        parameters: {
          type: 'object',
          properties: {
            sequence: { type: 'string', description: 'DNA sequence' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['sequence'],
        },
      },

      translate_dna: {
        name: 'translate_dna',
        description: 'Translate DNA sequence to protein (amino acid sequence)',
        parameters: {
          type: 'object',
          properties: {
            dna: { type: 'string', description: 'DNA sequence to translate' },
            frame: { type: 'number', description: 'Reading frame (0, 1, or 2)', default: 0 },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['dna'],
        },
      },

      reverse_complement: {
        name: 'reverse_complement',
        description: 'Get reverse complement of DNA sequence',
        parameters: {
          type: 'object',
          properties: {
            dna: { type: 'string', description: 'DNA sequence' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['dna'],
        },
      },

      search_sequence_motif: {
        name: 'search_sequence_motif',
        description: 'Search for sequence motifs in the genome. Supports exact matches, IUPAC ambiguity codes (N,R,Y,S,W,K,M,B,D,H,V), regular expressions, and mismatch tolerance.',
        parameters: {
          type: 'object',
          properties: {
            motif: { type: 'string', description: 'Motif pattern to search for (supports IUPAC codes: N=any, R=A/G, Y=C/T, etc.)' },
            pattern: { type: 'string', description: 'Alternative to motif - regex pattern or IUPAC motif string' },
            chromosome: { type: 'string', description: 'Chromosome to search in (optional, searches current view if not specified)' },
            start: { type: 'number', description: 'Start position for search region (optional)' },
            end: { type: 'number', description: 'End position for search region (optional)' },
            strand: { type: 'string', enum: ['+', '-', 'both'], description: 'Strand to search on', default: 'both' },
            max_mismatches: { type: 'number', description: 'Maximum allowed mismatches (0 for exact match)', minimum: 0, default: 0 },
            case_sensitive: { type: 'boolean', description: 'Whether search should be case sensitive', default: false },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['motif'],
        },
      },

      get_coding_sequence: {
        name: 'get_coding_sequence',
        description: 'Get the coding sequence (DNA) for a specific gene or locus tag',
        parameters: {
          type: 'object',
          properties: {
            identifier: { type: 'string', description: 'Gene name or locus tag (e.g., b0062, araA)' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['identifier'],
        },
      },

      find_restriction_sites: {
        name: 'find_restriction_sites',
        description: 'Locate recognition and cleavage sites for restriction endonucleases in a genomic region. Supports 80+ enzymes with IUPAC ambiguity codes and staggered cut positions.',
        parameters: {
          type: 'object',
          properties: {
            enzyme: { type: 'string', description: 'Restriction enzyme name (e.g., EcoRI, BamHI, HindIII, NotI). Use list_restriction_enzymes to browse all available enzymes.' },
            chromosome: { type: 'string', description: 'Chromosome to search (defaults to current active chromosome)' },
            start: { type: 'number', description: 'Start position of region to analyze' },
            end: { type: 'number', description: 'End position of region to analyze' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['enzyme'],
        },
      },

      virtual_digest: {
        name: 'virtual_digest',
        description: 'Perform an in-silico restriction digest of a chromosome using one or more restriction enzymes. Calculates fragment positions, sizes, and end types (5\' overhang, 3\' overhang, blunt).',
        parameters: {
          type: 'object',
          properties: {
            enzymes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of restriction enzyme names (e.g., ["EcoRI", "HindIII"])',
            },
            chromosome: { type: 'string', description: 'Chromosome to digest (defaults to current chromosome)' },
            start: { type: 'number', description: 'Start position of region to digest' },
            end: { type: 'number', description: 'End position of region to digest' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['enzymes'],
        },
      },

      list_restriction_enzymes: {
        name: 'list_restriction_enzymes',
        description: 'List available restriction enzymes from the built-in database (80+ enzymes). Supports filtering by query, recognition length, overhang type, and commercial availability.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query to filter enzymes by name or recognition sequence' },
            minRecognitionLength: { type: 'number', description: 'Minimum recognition sequence length' },
            maxRecognitionLength: { type: 'number', description: 'Maximum recognition sequence length' },
            overhangType: { type: 'string', enum: ["5'_overhang", "3'_overhang", 'blunt'], description: 'Filter by overhang type' },
            commercialOnly: { type: 'boolean', description: 'Only show commercially available enzymes', default: true },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
        },
      },

      simulate_gel_electrophoresis: {
        name: 'simulate_gel_electrophoresis',
        description: 'Simulate agarose gel electrophoresis to visualize restriction digest fragments. Renders DNA bands on a virtual gel based on fragment sizes from a virtual_digest result.',
        parameters: {
          type: 'object',
          properties: {
            fragments: {
              type: 'array',
              items: { type: 'object' },
              description: 'Fragment details from virtual_digest result (array of {length, start, end, index})',
            },
            enzymes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Restriction enzyme names used in the digest',
            },
            gelPercentage: { type: 'number', description: 'Agarose gel percentage (0.5-3.0, default 1.0)', default: 1.0 },
            ladderType: { type: 'string', description: 'DNA ladder type (1kb, 100bp, 2log, lambda_hindiii, lambda_ecori)', default: '1kb' },
            chromosome: { type: 'string', description: 'Chromosome name' },
            voltage: { type: 'number', description: 'Electrophoresis voltage in volts', default: 100 },
            runTime: { type: 'number', description: 'Run time in minutes', default: 45 },
            showLadder: { type: 'boolean', description: 'Show DNA ladder lane', default: true },
            label: { type: 'string', description: 'Custom label for digest lane' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['enzymes'],
        },
      },
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
      TTT: 'F',
      TTC: 'F',
      TTA: 'L',
      TTG: 'L',
      TCT: 'S',
      TCC: 'S',
      TCA: 'S',
      TCG: 'S',
      TAT: 'Y',
      TAC: 'Y',
      TAA: '*',
      TAG: '*',
      TGT: 'C',
      TGC: 'C',
      TGA: '*',
      TGG: 'W',
      CTT: 'L',
      CTC: 'L',
      CTA: 'L',
      CTG: 'L',
      CCT: 'P',
      CCC: 'P',
      CCA: 'P',
      CCG: 'P',
      CAT: 'H',
      CAC: 'H',
      CAA: 'Q',
      CAG: 'Q',
      CGT: 'R',
      CGC: 'R',
      CGA: 'R',
      CGG: 'R',
      ATT: 'I',
      ATC: 'I',
      ATA: 'I',
      ATG: 'M',
      ACT: 'T',
      ACC: 'T',
      ACA: 'T',
      ACG: 'T',
      AAT: 'N',
      AAC: 'N',
      AAA: 'K',
      AAG: 'K',
      AGT: 'S',
      AGC: 'S',
      AGA: 'R',
      AGG: 'R',
      GTT: 'V',
      GTC: 'V',
      GTA: 'V',
      GTG: 'V',
      GCT: 'A',
      GCC: 'A',
      GCA: 'A',
      GCG: 'A',
      GAT: 'D',
      GAC: 'D',
      GAA: 'E',
      GAG: 'E',
      GGT: 'G',
      GGC: 'G',
      GGA: 'G',
      GGG: 'G',
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
      A: 'T',
      T: 'A',
      G: 'C',
      C: 'G',
      a: 't',
      t: 'a',
      g: 'c',
      c: 'g',
      N: 'N',
      n: 'n',
    };

    return dna
      .split('')
      .reverse()
      .map(base => complement[base] || base)
      .join('');
  }
}

module.exports = SequenceTools;
