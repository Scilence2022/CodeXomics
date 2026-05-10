/**
 * PrimerToolSchemas.js
 * Single source of truth for primer tool parameter schemas and descriptions.
 * Used by PrimerFunctionTools, PrimerTools (MCP), and YAML registry generation.
 */

const PRIMER_TOOL_SCHEMAS = {
  calculate_primer_properties: {
    name: 'calculate_primer_properties',
    description: 'Calculate biochemical properties like melting temperature (Tm), GC content, and length for a given DNA primer sequence (18-35 bp). Use this to check if a sequence is suitable as a PCR or sequencing primer.',
    parameters: {
      type: 'object',
      properties: {
        sequence: {
          type: 'string',
          description: 'The DNA primer sequence to analyze (only containing A, T, C, G)',
        },
      },
      required: ['sequence'],
    },
  },

  design_primers: {
    name: 'design_primers',
    description: 'Design a forward and reverse primer pair to amplify a target DNA sequence. This automatically finds optimal primers matching length, GC, and melting temperature criteria. Provide at least 150bp of sequence, or use geneName or chromosome/start/end to fetch it.',
    parameters: {
      type: 'object',
      properties: {
        targetSequence: {
          type: 'string',
          description: 'The full DNA sequence region containing the desired amplicon. If not provided, use geneName or chromosome/start/end.',
        },
        geneName: {
          type: 'string',
          description: 'Name of the gene to fetch the coding sequence for primer design',
        },
        chromosome: {
          type: 'string',
          description: 'Chromosome/replicon ID for the target region',
        },
        start: {
          type: 'number',
          description: 'Start position of the target region (used with chromosome)',
        },
        end: {
          type: 'number',
          description: 'End position of the target region (used with chromosome)',
        },
        targetTm: {
          type: 'number',
          description: 'Target melting temperature (default: 60.0)',
        },
        minProductSize: {
          type: 'number',
          description: 'Minimum PCR product size (default: 100)',
        },
      },
      required: [],
    },
  },

  find_primer_binding_sites: {
    name: 'find_primer_binding_sites',
    description: 'Search for binding sites of a specific primer sequence within a larger template (e.g. searching a gene sequence). Finds both forward and reverse occurrences.',
    parameters: {
      type: 'object',
      properties: {
        primerSequence: {
          type: 'string',
          description: 'The short primer DNA sequence',
        },
        templateSequence: {
          type: 'string',
          description: 'The larger template DNA sequence to search within. If not provided, fetch it first via sequence tools.',
        },
        maxMismatches: {
          type: 'number',
          description: 'Maximum number of mismatched bases allowed (default: 0)',
        },
      },
      required: ['primerSequence', 'templateSequence'],
    },
  },

  add_primer_annotation: {
    name: 'add_primer_annotation',
    description: 'Add an interactive primer display to the genome track',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the primer (e.g., Fwd_1)',
        },
        chromosome: {
          type: 'string',
          description: 'Chromosome/replicon ID where the primer binds',
        },
        start: {
          type: 'number',
          description: 'Start position (5\' end)',
        },
        end: {
          type: 'number',
          description: 'End position (3\' end)',
        },
        strand: {
          type: 'string',
          description: 'Strand (+ or -)',
        },
        description: {
          type: 'string',
          description: 'Optional description or properties (e.g. "Tm: 60C, GC: 50%")',
        },
      },
      required: ['name', 'chromosome', 'start', 'end'],
    },
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PRIMER_TOOL_SCHEMAS;
}
if (typeof window !== 'undefined') {
  window.PRIMER_TOOL_SCHEMAS = PRIMER_TOOL_SCHEMAS;
}
