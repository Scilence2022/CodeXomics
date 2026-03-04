/**
 * Primer Design Tools Module
 * Handles PCR primer design, analysis, and validation through MCP
 */

class PrimerTools {
  constructor(server) {
    this.server = server;
  }

  getTools() {
    return {
      design_pcr_primers: {
        name: 'design_pcr_primers',
        description: 'Design PCR primers for a DNA sequence or genomic region. Returns forward and reverse primers with Tm, GC content, and compatibility analysis.',
        parameters: {
          type: 'object',
          properties: {
            sequence: {
              type: 'string',
              description: 'Target DNA sequence (ATGC only) or "current_region" to use visible genome region'
            },
            chromosome: {
              type: 'string',
              description: 'Chromosome name (if using genomic coordinates instead of sequence)'
            },
            start: {
              type: 'number',
              description: 'Start position (1-based, if using genomic coordinates)'
            },
            end: {
              type: 'number',
              description: 'End position (1-based, if using genomic coordinates)'
            },
            targetTm: {
              type: 'number',
              description: 'Target melting temperature in Celsius (default: 60)',
              default: 60
            },
            tmTolerance: {
              type: 'number',
              description: 'Acceptable Tm deviation (default: 3)',
              default: 3
            },
            minLength: {
              type: 'number',
              description: 'Minimum primer length (default: 18)',
              default: 18
            },
            maxLength: {
              type: 'number',
              description: 'Maximum primer length (default: 25)',
              default: 25
            },
            minGC: {
              type: 'number',
              description: 'Minimum GC content percentage (default: 40)',
              default: 40
            },
            maxGC: {
              type: 'number',
              description: 'Maximum GC content percentage (default: 60)',
              default: 60
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID'
            }
          },
          required: [],
        },
      },

      design_qpcr_primers: {
        name: 'design_qpcr_primers',
        description: 'Design qPCR primers optimized for quantitative PCR (shorter amplicons, balanced Tm). Returns primers with qPCR-specific validation.',
        parameters: {
          type: 'object',
          properties: {
            sequence: {
              type: 'string',
              description: 'Target DNA sequence or "current_region"'
            },
            chromosome: {
              type: 'string',
              description: 'Chromosome name (if using genomic coordinates)'
            },
            start: {
              type: 'number',
              description: 'Start position (1-based)'
            },
            end: {
              type: 'number',
              description: 'End position (1-based)'
            },
            targetTm: {
              type: 'number',
              description: 'Target melting temperature (default: 60)',
              default: 60
            },
            maxAmpliconSize: {
              type: 'number',
              description: 'Maximum amplicon size for qPCR (default: 200)',
              default: 200
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID'
            }
          },
          required: [],
        },
      },

      design_primers_for_gene: {
        name: 'design_primers_for_gene',
        description: 'Design PCR primers for a specific gene by name or locus tag. Automatically extracts gene sequence and designs primers.',
        parameters: {
          type: 'object',
          properties: {
            geneName: {
              type: 'string',
              description: 'Gene name or locus tag (e.g., dnaA, b0062)'
            },
            targetTm: {
              type: 'number',
              description: 'Target melting temperature (default: 60)',
              default: 60
            },
            flankSize: {
              type: 'number',
              description: 'Flanking region size to include (default: 100)',
              default: 100
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID'
            }
          },
          required: ['geneName'],
        },
      },

      design_primers: {
        name: 'design_primers',
        description: 'Alias for design_primers_for_gene. Design PCR primers for a specific gene by name or locus tag.',
        parameters: {
          type: 'object',
          properties: {
            geneName: {
              type: 'string',
              description: 'Gene name or locus tag (e.g., dnaA, b0062)'
            },
            targetTm: {
              type: 'number',
              description: 'Target melting temperature (default: 60)',
              default: 60
            },
            flankSize: {
              type: 'number',
              description: 'Flanking region size to include (default: 100)',
              default: 100
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID'
            }
          },
          required: ['geneName'],
        },
      },

      analyze_primer_structure: {
        name: 'analyze_primer_structure',
        description: 'Analyze a primer sequence for secondary structures (hairpins) and self-dimer formation. Returns stability assessment.',
        parameters: {
          type: 'object',
          properties: {
            sequence: {
              type: 'string',
              description: 'Primer DNA sequence to analyze'
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID'
            }
          },
          required: ['sequence'],
        },
      },

      analyze_primer_pair: {
        name: 'analyze_primer_pair',
        description: 'Analyze compatibility of a forward/reverse primer pair. Checks Tm balance and cross-dimer formation.',
        parameters: {
          type: 'object',
          properties: {
            forwardSequence: {
              type: 'string',
              description: 'Forward primer sequence'
            },
            reverseSequence: {
              type: 'string',
              description: 'Reverse primer sequence'
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID'
            }
          },
          required: ['forwardSequence', 'reverseSequence'],
        },
      },

      calculate_tm: {
        name: 'calculate_tm',
        description: 'Calculate melting temperature (Tm) of a DNA sequence using nearest-neighbor thermodynamics.',
        parameters: {
          type: 'object',
          properties: {
            sequence: {
              type: 'string',
              description: 'DNA sequence'
            },
            method: {
              type: 'string',
              description: 'Calculation method: nearest_neighbor, basic, or salt_adjusted',
              default: 'nearest_neighbor'
            },
            saltConc: {
              type: 'number',
              description: 'Salt concentration in mM (default: 50)',
              default: 50
            },
            primerConc: {
              type: 'number',
              description: 'Primer concentration in µM (default: 0.5)',
              default: 0.5
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID'
            }
          },
          required: ['sequence'],
        },
      },

      validate_primer: {
        name: 'validate_primer',
        description: 'Validate a primer sequence against standard design rules (GC content, length, poly-runs).',
        parameters: {
          type: 'object',
          properties: {
            sequence: {
              type: 'string',
              description: 'Primer sequence to validate'
            },
            minGC: {
              type: 'number',
              description: 'Minimum GC content (default: 40)',
              default: 40
            },
            maxGC: {
              type: 'number',
              description: 'Maximum GC content (default: 60)',
              default: 60
            },
            minLength: {
              type: 'number',
              description: 'Minimum length (default: 15)',
              default: 15
            },
            maxLength: {
              type: 'number',
              description: 'Maximum length (default: 30)',
              default: 30
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID'
            }
          },
          required: ['sequence'],
        },
      },

      export_primers: {
        name: 'export_primers',
        description: 'Export primer design results to CSV, FASTA, or JSON format.',
        parameters: {
          type: 'object',
          properties: {
            primerData: {
              type: 'object',
              description: 'Primer design result object from design_pcr_primers'
            },
            format: {
              type: 'string',
              description: 'Export format: csv, fasta, or json',
              default: 'csv'
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID'
            }
          },
          required: ['primerData'],
        },
      },

      add_primer_to_track: {
        name: 'add_primer_to_track',
        description: 'Add designed primers as annotations to the genome browser for visualization.',
        parameters: {
          type: 'object',
          properties: {
            forwardPrimer: {
              type: 'object',
              description: 'Forward primer object with genomicPosition'
            },
            reversePrimer: {
              type: 'object',
              description: 'Reverse primer object with genomicPosition'
            },
            name: {
              type: 'string',
              description: 'Name for the primer pair (default: auto-generated)'
            },
            color: {
              type: 'string',
              description: 'Color for visualization (default: #FF6B6B)',
              default: '#FF6B6B'
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID'
            }
          },
          required: ['forwardPrimer', 'reversePrimer'],
        },
      },
    };
  }

  async executeClientTool(toolName, parameters, clientId) {
    return await this.server.executeToolOnClient(toolName, parameters, clientId);
  }

  // Server-side Tm calculation (can be done without client)
  calculateTm(sequence, options = {}) {
    const seq = sequence.toUpperCase().trim();
    if (seq.length === 0) return 0;

    const { method = 'basic' } = options;

    if (method === 'basic') {
      // Basic formula
      const a = (seq.match(/A/g) || []).length;
      const t = (seq.match(/T/g) || []).length;
      const g = (seq.match(/G/g) || []).length;
      const c = (seq.match(/C/g) || []).length;

      if (seq.length < 14) {
        return 2 * (a + t) + 4 * (g + c);
      } else {
        const gcPercent = ((g + c) / seq.length) * 100;
        return 81.5 + 0.41 * gcPercent - 675 / seq.length;
      }
    }

    // For more accurate methods, delegate to client
    return null;
  }

  // Server-side validation
  validatePrimer(sequence, options = {}) {
    const seq = sequence.toUpperCase().replace(/[^ATGC]/g, '');
    const {
      minGC = 40,
      maxGC = 60,
      minLength = 15,
      maxLength = 30
    } = options;

    const gcCount = (seq.match(/[GC]/g) || []).length;
    const gcContent = (gcCount / seq.length) * 100;

    const issues = [];
    if (gcContent < minGC) issues.push(`GC content too low (${gcContent.toFixed(1)}%)`);
    if (gcContent > maxGC) issues.push(`GC content too high (${gcContent.toFixed(1)}%)`);
    if (seq.length < minLength) issues.push(`Length too short (${seq.length} bp)`);
    if (seq.length > maxLength) issues.push(`Length too long (${seq.length} bp)`);

    // Check for poly-runs
    const polyRuns = seq.match(/A{5,}|T{5,}|G{5,}|C{5,}/g);
    if (polyRuns) issues.push(`Poly-base runs detected: ${polyRuns.join(', ')}`);

    return {
      isValid: issues.length === 0,
      sequence: seq,
      length: seq.length,
      gcContent: parseFloat(gcContent.toFixed(2)),
      tm: this.calculateTm(seq),
      issues: issues
    };
  }
}

module.exports = PrimerTools;