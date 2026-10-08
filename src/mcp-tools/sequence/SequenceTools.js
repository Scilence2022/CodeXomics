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
            chromosome: {
              type: 'string',
              description:
                'Chromosome/contig name exactly as loaded (see get_chromosome_list or get_current_state). Omit to use the chromosome currently displayed; do not invent names such as "chr1".',
            },
            start: { type: 'number', description: 'Start position (1-based)' },
            end: { type: 'number', description: 'End position (1-based)' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['start', 'end'],
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

      calc_region_gc: {
        name: 'calc_region_gc',
        description:
          'Calculate GC content for a chromosome coordinate range from the currently loaded genome. Prefer this for genomic positions or the current browser region; use compute_gc when the sequence string is already provided.',
        parameters: {
          type: 'object',
          properties: {
            chromosome: {
              type: 'string',
              description: 'Chromosome name. If omitted, uses the current selected/browsed chromosome.',
            },
            start: {
              type: 'number',
              description: '1-based start coordinate. If omitted, uses the current visible region start.',
            },
            end: {
              type: 'number',
              description: '1-based inclusive end coordinate. If omitted, uses the current visible region end.',
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: [],
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
            reading_frame: { type: 'number', description: 'Reading frame (1, 2, or 3)', enum: [1, 2, 3] },
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
        description:
          'Search for sequence motifs in the genome. Supports exact matches, IUPAC ambiguity codes (N,R,Y,S,W,K,M,B,D,H,V), regular expressions, and mismatch tolerance.',
        parameters: {
          type: 'object',
          properties: {
            motif: {
              type: 'string',
              description: 'Motif pattern to search for (supports IUPAC codes: N=any, R=A/G, Y=C/T, etc.)',
            },
            pattern: { type: 'string', description: 'Alternative to motif - regex pattern or IUPAC motif string' },
            chromosome: {
              type: 'string',
              description: 'Chromosome to search in (optional, searches current view if not specified)',
            },
            start: { type: 'number', description: 'Start position for search region (optional)' },
            end: { type: 'number', description: 'End position for search region (optional)' },
            strand: { type: 'string', enum: ['+', '-', 'both'], description: 'Strand to search on', default: 'both' },
            max_mismatches: {
              type: 'number',
              description: 'Maximum allowed mismatches (0 for exact match)',
              minimum: 0,
              default: 0,
            },
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

      calculate_entropy: {
        name: 'calculate_entropy',
        description:
          'Calculate Shannon entropy of a DNA or protein sequence as a measure of sequence complexity (0-2 bits for DNA, 0-4.32 for protein)',
        parameters: {
          type: 'object',
          properties: {
            sequence: { type: 'string', description: 'DNA or protein sequence to calculate entropy for' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['sequence'],
        },
      },

      calculate_molecular_weight: {
        name: 'calculate_molecular_weight',
        description: 'Calculate the molecular weight of a DNA, RNA, or protein sequence in Daltons',
        parameters: {
          type: 'object',
          properties: {
            sequence: {
              type: 'string',
              description: 'DNA, RNA, or protein sequence to calculate molecular weight for',
            },
            dna: { type: 'string', description: 'DNA/RNA sequence (legacy parameter)' },
            protein: { type: 'string', description: 'Protein sequence' },
            type: {
              type: 'string',
              enum: ['dna', 'protein', 'auto'],
              description: 'Sequence type: dna, protein, or auto (defaults to auto)',
              default: 'auto',
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
        },
      },

      find_restriction_sites: {
        name: 'find_restriction_sites',
        description:
          'Locate recognition and cleavage sites for restriction endonucleases in a genomic region. Supports 80+ enzymes with IUPAC ambiguity codes and staggered cut positions.',
        parameters: {
          type: 'object',
          properties: {
            enzyme: {
              type: 'string',
              description:
                'Restriction enzyme name (e.g., EcoRI, BamHI, HindIII, NotI). Use list_restriction_enzymes to browse all available enzymes.',
            },
            chromosome: { type: 'string', description: 'Chromosome to search (defaults to current active chromosome)' },
            start: { type: 'number', description: 'Start position of region to analyze' },
            end: { type: 'number', description: 'End position of region to analyze' },
            sequence: {
              type: 'string',
              description:
                'DNA sequence to search directly (optional). Use only if chromosome position info is not available.',
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['enzyme'],
        },
      },

      virtual_digest: {
        name: 'virtual_digest',
        description:
          'Perform an in-silico restriction digest of a chromosome or sequence using one or more restriction enzymes. Priority should be given to chromosome-position mode to avoid bloating LLM context.',
        parameters: {
          type: 'object',
          properties: {
            enzymes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of restriction enzyme names (e.g., ["EcoRI", "HindIII"])',
            },
            chromosome: {
              type: 'string',
              description:
                'Chromosome to digest (defaults to current chromosome). Priority should be given to chromosome-position mode over direct sequence mode.',
            },
            start: { type: 'number', description: 'Start position of region to digest' },
            end: { type: 'number', description: 'End position of region to digest' },
            sequence: {
              type: 'string',
              description:
                'DNA sequence to digest directly (optional). Use only if chromosome position info is not available.',
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['enzymes'],
        },
      },

      list_restriction_enzymes: {
        name: 'list_restriction_enzymes',
        description:
          'List available restriction enzymes from the built-in database (80+ enzymes). Supports filtering by query, recognition length, overhang type, and commercial availability.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query to filter enzymes by name or recognition sequence' },
            minRecognitionLength: { type: 'number', description: 'Minimum recognition sequence length' },
            maxRecognitionLength: { type: 'number', description: 'Maximum recognition sequence length' },
            overhangType: {
              type: 'string',
              enum: ["5'_overhang", "3'_overhang", 'blunt'],
              description: 'Filter by overhang type',
            },
            commercialOnly: { type: 'boolean', description: 'Only show commercially available enzymes', default: true },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
        },
      },

      simulate_gel_electrophoresis: {
        name: 'simulate_gel_electrophoresis',
        description:
          'Simulate agarose gel electrophoresis to visualize restriction digest fragments. Visualization-only tool — call virtual_digest first and pass its fragmentDetails.',
        parameters: {
          type: 'object',
          properties: {
            fragments: {
              type: 'array',
              items: { type: 'object' },
              description:
                'Fragment details from virtual_digest result (array of {length, start, end, index}). REQUIRED.',
            },
            gelPercentage: {
              type: 'number',
              description: 'Agarose gel percentage (0.5-3.0, default 1.0)',
              default: 1.0,
            },
            ladderType: {
              type: 'string',
              description: 'DNA ladder/marker type (1kb, 100bp, 2log, lambda_hindiii, lambda_ecori)',
              default: '1kb',
            },
            laneLabel: { type: 'string', description: 'Label for the sample lane' },
            voltage: { type: 'number', description: 'Electrophoresis voltage in volts', default: 100 },
            runTime: { type: 'number', description: 'Run time in minutes', default: 45 },
            showLadder: { type: 'boolean', description: 'Show DNA ladder lane', default: true },
            bandColorScheme: {
              type: 'string',
              description: 'Band color scheme (ethidium_bromide, gel_red, sybr_safe, methylene_blue, uv_default)',
              default: 'ethidium_bromide',
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['fragments'],
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
    const processing = require('../../renderer/modules/UnifiedSequenceProcessing');
    const result = processing.reverseComplement(dna, { caseSensitive: true, validateInput: false });
    if (!result.success) throw new Error(result.error);
    return result.sequence;
  }

  calculateEntropy(sequence) {
    if (!sequence || typeof sequence !== 'string') return 0;
    const counts = {};
    for (const base of sequence.toUpperCase()) {
      counts[base] = (counts[base] || 0) + 1;
    }
    const length = sequence.length;
    let entropy = 0;
    for (const count of Object.values(counts)) {
      const p = count / length;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  calculateMolecularWeight(sequence, type = 'auto') {
    return require('../../renderer/modules/UnifiedSequenceProcessing').calculateMolecularWeight(sequence, type);
  }
}

module.exports = SequenceTools;
