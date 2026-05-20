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
    description: 'Design a forward and reverse primer pair to amplify a target DNA sequence. Use upstreamBp/downstreamBp when the amplicon must include flanking bases; both are interpreted relative to gene strand, so reverse-strand upstream is higher genomic coordinates and reverse-strand downstream is lower genomic coordinates. Provide at least 150bp of sequence, or use geneName or chromosome/start/end to fetch it.',
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
        upstreamBp: {
          type: 'number',
          description: 'Number of bases upstream of the gene translation/start boundary that must be included in the PCR product. For reverse-strand genes, upstream means higher genomic coordinates.',
          minimum: 0,
        },
        upstreamBases: {
          type: 'number',
          description: 'Alias for upstreamBp; number of biologically upstream bases to include in the amplicon.',
          minimum: 0,
        },
        upstream: {
          type: 'number',
          description: 'Alias for upstreamBp for natural language phrases like "50 up" or "50 upstream".',
          minimum: 0,
        },
        downstreamBp: {
          type: 'number',
          description: 'Number of bases downstream of the gene stop/end boundary that must be included in the PCR product. For reverse-strand genes, downstream means lower genomic coordinates.',
          minimum: 0,
        },
        downstreamBases: {
          type: 'number',
          description: 'Alias for downstreamBp; number of biologically downstream bases to include in the amplicon.',
          minimum: 0,
        },
        downstream: {
          type: 'number',
          description: 'Alias for downstreamBp for natural language phrases like "50 downstream".',
          minimum: 0,
        },
        upstreamPrimerBuffer: {
          type: 'number',
          description: 'Extra biologically upstream bases to search before the required upstream interval so primers can bind while still including upstreamBp bases (default: 75).',
          minimum: 0,
        },
        downstreamPrimerBuffer: {
          type: 'number',
          description: 'Extra biologically downstream bases to search past the gene end so the reverse primer can bind outside the CDS when possible (default: 75).',
          minimum: 0,
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
        tmTolerance: {
          type: 'number',
          description: 'Allowed Tm deviation from targetTm in Celsius before relaxed search tiers are tried (default: 2.0).',
          minimum: 0,
        },
        primerLength: {
          type: 'number',
          description: 'Exact primer length to use. Sets both minPrimerLength and maxPrimerLength unless those are provided.',
          minimum: 1,
        },
        primerLengthBp: {
          type: 'number',
          description: 'Alias for primerLength.',
          minimum: 1,
        },
        minPrimerLength: {
          type: 'number',
          description: 'Minimum primer length in bases (default: 18).',
          minimum: 1,
        },
        maxPrimerLength: {
          type: 'number',
          description: 'Maximum primer length in bases (default: 25).',
          minimum: 1,
        },
        minProductSize: {
          type: 'number',
          description: 'Minimum PCR product size (default: 100)',
        },
        maxProductSize: {
          type: 'number',
          description: 'Maximum PCR product size (default: full target sequence length).',
          minimum: 1,
        },
        minGcContent: {
          type: 'number',
          description: 'Minimum primer GC percentage. If set, the GC range is treated as a hard constraint.',
          minimum: 0,
          maximum: 100,
        },
        maxGcContent: {
          type: 'number',
          description: 'Maximum primer GC percentage. If set, the GC range is treated as a hard constraint.',
          minimum: 0,
          maximum: 100,
        },
        requireGcClamp: {
          type: 'boolean',
          description: 'Whether primer candidates must end in G/C. Defaults to true in strict tiers and false in relaxed tiers.',
        },
        avoidHairpin: {
          type: 'boolean',
          description: 'Whether to reject primers with simple hairpin potential. Defaults to true in strict tiers and false in the most relaxed tier.',
        },
        requiredAmpliconStart: {
          type: 'number',
          description: 'Advanced use with targetSequence: 0-based sequence offset that the primer product must start at or before.',
          minimum: 0,
        },
        requiredAmpliconEnd: {
          type: 'number',
          description: 'Advanced use with targetSequence: 0-based exclusive sequence offset that the primer product must end at or after.',
          minimum: 0,
        },
      },
      required: [],
    },
  },

  find_primer_binding_sites: {
    name: 'find_primer_binding_sites',
    description: 'Search for binding sites of a specific primer sequence within a larger template (e.g. searching a gene sequence or current genome). Finds both forward and reverse occurrences.',
    parameters: {
      type: 'object',
      properties: {
        sequence: {
          type: 'string',
          description: 'The short primer DNA sequence to search for (e.g. GCAATATGTCTCTGTGTGGAT).',
        },
        primerSequence: {
          type: 'string',
          description: 'Alias for sequence. The short primer DNA sequence.',
        },
        templateSequence: {
          type: 'string',
          description: 'Optional. The larger template DNA sequence to search within. If not provided, the tool will automatically search the current active genome or chromosome.',
        },
        maxMismatches: {
          type: 'number',
          description: 'Maximum number of mismatched bases allowed (default: 0)',
        },
      },
      required: [],
    },
  },

  add_primer_annotation: {
    name: 'add_primer_annotation',
    description: 'Add an interactive primer display to the dedicated Primers track',
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

  list_primer_annotations: {
    name: 'list_primer_annotations',
    description: 'List primer annotations currently displayed in the Primers track, optionally filtered by chromosome or genomic interval.',
    parameters: {
      type: 'object',
      properties: {
        chromosome: {
          type: 'string',
          description: 'Optional chromosome/replicon ID to filter primers',
        },
        start: {
          type: 'number',
          description: 'Optional interval start position',
        },
        end: {
          type: 'number',
          description: 'Optional interval end position',
        },
      },
      required: [],
    },
  },

  clear_primer_annotations: {
    name: 'clear_primer_annotations',
    description: 'Clear primer annotations from the Primers track. Requires confirm=true to prevent accidental deletion.',
    parameters: {
      type: 'object',
      properties: {
        chromosome: {
          type: 'string',
          description: 'Optional chromosome/replicon ID. If omitted, clears primer annotations from all chromosomes.',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to clear primer annotations.',
        },
      },
      required: ['confirm'],
    },
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PRIMER_TOOL_SCHEMAS;
}
if (typeof window !== 'undefined') {
  window.PRIMER_TOOL_SCHEMAS = PRIMER_TOOL_SCHEMAS;
}
