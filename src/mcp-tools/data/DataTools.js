/**
 * Data Management Tools Module
 * Handles data annotation, export, and codon usage analysis
 */

const GenomeAnalysisService = require('../../renderer/modules/chat/services/GenomeAnalysisService');

class DataTools {
  constructor(server) {
    this.server = server;
  }

  getTools() {
    return {
      create_annotation: {
        name: 'create_annotation',
        description:
          'Create a new user-defined biological annotation (e.g. gene, CDS, tRNA, promoter, primer) with type-specific validation and processing.',
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description:
                'Feature type (gene, CDS, mRNA, tRNA, rRNA, promoter, regulatory, terminator, ribosome_binding_site, primer, other)',
            },
            name: { type: 'string', description: 'Feature name/identifier (e.g., lacZ)' },
            chromosome: { type: 'string', description: 'Chromosome or contig name' },
            start: { type: 'number', description: 'Genomic start position (1-based)' },
            end: { type: 'number', description: 'Genomic end position (1-based inclusive)' },
            strand: {
              type: 'number',
              description: 'Strand direction: 1 for forward (+), -1 for reverse (-)',
              default: 1,
            },
            description: { type: 'string', description: 'Description or notes' },
            product: { type: 'string', description: 'Protein product or RNA product description' },
            codonStart: { type: 'number', description: 'Codon start frame (1, 2, or 3) for CDS features', default: 1 },
            translTable: {
              type: 'number',
              description: 'Translation genetic code table ID (e.g. 11 for bacteria) for CDS features',
              default: 11,
            },
            translation: {
              type: 'string',
              description: 'Protein sequence for CDS features. Auto-translated from DNA if omitted.',
            },
            anticodon: { type: 'string', description: 'Anticodon for tRNA features (e.g. GAA)' },
            regulatoryClass: {
              type: 'string',
              description:
                'Regulatory class (e.g. promoter, terminator, ribosome_binding_site) for regulatory features',
            },
            sequence: { type: 'string', description: 'Specific nucleotide sequence for primer features' },
            direction: { type: 'string', description: 'Primer direction (forward or reverse) for primer features' },
            qualifiers: { type: 'object', description: 'Any custom key-value pairs/qualifiers to add to the feature' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['type', 'name', 'chromosome', 'start', 'end'],
        },
      },

      export_data: {
        name: 'export_data',
        description: 'Export sequence or annotation data',
        parameters: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              description: 'Output format. Defaults to genbank.',
              enum: ['fasta', 'genbank', 'gb', 'gbk', 'gff', 'gff3', 'bed', 'cds', 'protein'],
              default: 'genbank',
            },
            chromosome: { type: 'string', description: 'Chromosome (optional for full export)' },
            start: { type: 'integer', description: 'Start position (optional)' },
            end: { type: 'integer', description: 'End position (optional)' },
            filename: {
              type: 'string',
              description:
                'Output file path. Supports absolute paths (e.g., "/Users/user/output/genome.fasta") and relative paths (resolved against CWD). Uses default filename if not specified.',
            },
            auto_save: {
              type: 'boolean',
              description:
                'When true, save the file directly without showing a save dialog. Essential for LLM/agent automated workflows where dialog prompts block execution.',
              default: false,
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: [],
        },
      },

      codon_usage_analysis: {
        name: 'codon_usage_analysis',
        description:
          'Count codons in a supplied sequence (works offline) or look up a geneName or locusTag in a loaded genome window. Return summary counts or detailed observed frequencies.',
        parameters: {
          type: 'object',
          properties: {
            sequence: {
              type: 'string',
              minLength: 3,
              pattern: '^[ACGTUNRYSWKMBDHVacgtunryswkmbdhv\\s]+$',
              description:
                'Coding nucleotide sequence. Whitespace is ignored. Takes precedence over geneName and locusTag.',
            },
            geneName: {
              type: 'string',
              minLength: 1,
              description: 'Gene name to find in the loaded genome, or a label when sequence is supplied.',
            },
            locusTag: { type: 'string', minLength: 1, description: 'Locus tag to look up in the loaded genome.' },
            chromosome: {
              type: 'string',
              minLength: 1,
              description:
                'Chromosome for gene lookup, or the source of the annotated genetic code for a supplied sequence. Requires a genome window.',
            },
            genetic_code: {
              type: 'string',
              description:
                'NCBI translation table ID as a string, or table name. Overrides the annotation. A supplied sequence without a chromosome uses the standard table.',
            },
            include_statistics: {
              type: 'boolean',
              default: true,
              description: 'Return per-codon statistics. Set false for the summary only.',
            },
            includeStatistics: {
              type: 'boolean',
              description: 'Compatibility alias for include_statistics. The snake_case value takes precedence.',
            },
            organism: {
              type: 'string',
              description: 'Optional descriptive label copied to the result. Does not select the genetic code.',
            },
            clientId: { type: 'string', description: 'Browser client ID for window routing.' },
          },
          required: [],
          anyOf: [{ required: ['sequence'] }, { required: ['geneName'] }, { required: ['locusTag'] }],
        },
      },

      genome_codon_usage_analysis: {
        name: 'genome_codon_usage_analysis',
        description:
          'Perform comprehensive genome-wide codon usage analysis across all CDS features to identify codon preferences and biases at the organism level. Analyzes synonymous codon preferences, calculates RSCU values, and provides detailed statistical analysis.',
        parameters: {
          type: 'object',
          properties: {
            chromosome: {
              type: 'string',
              description: 'Specific chromosome/contig to analyze (optional, analyzes all if not specified)',
            },
            featureType: {
              type: 'string',
              description: 'Type of features to analyze (default CDS)',
              default: 'CDS',
              enum: ['CDS', 'gene', 'mRNA'],
            },
            minLength: {
              type: 'integer',
              description: 'Minimum feature length in base pairs (default 300)',
              default: 300,
            },
            maxGenes: { type: 'integer', description: 'Maximum number of genes to analyze (optional)' },
            clientId: { type: 'string', description: 'Browser client ID' },
            genetic_code: {
              type: 'string',
              description:
                'Genetic code: an NCBI translation table id ("11", "4") or a name (standard, bacterial, mycoplasma, vertebrate_mitochondrial). Omit it to use the code the genome is annotated with (/transl_table), which is almost always correct.',
            },
          },
          required: [],
        },
      },
    };
  }

  async executeClientTool(toolName, parameters, clientId) {
    return await this.server.executeToolOnClient(toolName, parameters, clientId);
  }

  async analyzeCodonUsage(parameters, clientId, executionContext) {
    if (parameters.sequence === undefined || parameters.chromosome || parameters.windowId || parameters.expected_genome) {
      if (!this.server?.executeToolOnClient) {
        throw new Error('This lookup requires a connected genome window. Supply sequence alone for offline analysis.');
      }
      return this.server.executeToolOnClient('codon_usage_analysis', parameters, clientId, executionContext);
    }
    return new GenomeAnalysisService(null, null).codonUsageAnalysis(parameters);
  }
}

module.exports = DataTools;
