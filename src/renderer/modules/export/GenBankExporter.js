/**
 * GenBankExporter - Unified GenBank format export
 *
 * Consolidates all GenBank generation logic into a single, testable class.
 * Eliminates 400+ lines of duplicate code across multiple methods.
 *
 * @class
 * @version 1.0.0
 */
class GenBankExporter {
  /**
   * Create GenBankExporter instance
   * @param {Object} genomeBrowser - GenomeBrowser instance for accessing source features
   */
  constructor(genomeBrowser) {
    this.genomeBrowser = genomeBrowser;
  }

  /**
   * Main export method - generates complete GenBank content
   *
   * @param {Object} params - Export parameters
   * @param {Array<string>} params.chromosomes - Array of chromosome names
   * @param {Function} params.getSequence - Function(chr) => sequence string
   * @param {Function} params.getFeatures - Function(chr) => features array
   * @param {Array} params.executedActions - Array of executed actions (optional)
   * @param {string} params.executionId - Execution ID for tracking (optional)
   * @param {Object} params.options - Export options (optional)
   * @returns {string} Complete GenBank formatted content
   */
  exportGenBank(params) {
    const { chromosomes, getSequence, getFeatures, executedActions = [], executionId = null, options = {} } = params;

    if (!chromosomes || chromosomes.length === 0) {
      throw new Error('No chromosomes provided for export');
    }
    if (typeof getSequence !== 'function') {
      throw new Error('getSequence must be a function');
    }
    if (typeof getFeatures !== 'function') {
      throw new Error('getFeatures must be a function');
    }

    let content = '';

    for (const chr of chromosomes) {
      const sequence = getSequence(chr);
      const features = getFeatures(chr);
      const chrActions = executedActions.filter(a => a.metadata?.chromosome === chr);

      content += this.generateChromosomeContent({
        chromosome: chr,
        sequence,
        features,
        actions: chrActions,
        executionId,
        options,
      });

      // Add blank line between chromosomes
      if (chromosomes.indexOf(chr) < chromosomes.length - 1) {
        content += '\n';
      }
    }

    return content;
  }

  /**
   * Generate GenBank content for a single chromosome
   *
   * @param {Object} params - Chromosome export parameters
   * @returns {string} GenBank formatted content for chromosome
   */
  generateChromosomeContent(params) {
    const { chromosome, sequence, features, actions, executionId, options } = params;

    if (!sequence) {
      throw new Error(`No sequence provided for chromosome ${chromosome}`);
    }

    const sourceFeatures = this.genomeBrowser.sourceFeatures?.[chromosome] || {};
    const originalAnnotations = this.genomeBrowser.currentAnnotations?.[chromosome] || [];

    let content = '';

    // LOCUS line
    content += this.generateLocus(chromosome, sequence, sourceFeatures, originalAnnotations);

    // Modification history (if actions exist)
    if (actions && actions.length > 0 && executionId) {
      content += this.generateActionHistory(actions, executionId);
    }

    // DEFINITION line
    content += this.generateDefinition(chromosome, sourceFeatures, originalAnnotations);

    // ACCESSION line
    content += this.generateAccession(chromosome, sourceFeatures, originalAnnotations);

    // VERSION line
    content += this.generateVersion(chromosome, sourceFeatures, originalAnnotations);

    // KEYWORDS line
    content += this.generateKeywords(sourceFeatures, originalAnnotations);

    // SOURCE and ORGANISM lines
    content += this.generateSource(sourceFeatures, originalAnnotations);

    // FEATURES section
    content += this.generateFeatures(chromosome, sequence, features, sourceFeatures);

    // ORIGIN section (sequence data)
    content += this.generateOrigin(sequence);

    // End marker
    content += '//\n';

    return content;
  }

  /**
   * Generate LOCUS line
   */
  generateLocus(chromosome, sequence, sourceFeatures, originalAnnotations) {
    const isCircular =
      sourceFeatures.mol_type?.includes('circular') ||
      originalAnnotations.find(f => f.type === 'source' && f.qualifiers?.mol_type?.includes('circular')) ||
      false;
    const topology = isCircular ? 'circular' : 'linear';
    const dateStr = new Date().toISOString().slice(0, 10);
    const locusName = chromosome.length > 16 ? chromosome.substring(0, 16) : chromosome.padEnd(16);

    return `LOCUS       ${locusName} ${sequence.length} bp    DNA     ${topology}   UNK ${dateStr}\n`;
  }

  /**
   * Generate action history as COMMENT section
   */
  generateActionHistory(actions, executionId) {
    let content = '';
    content += 'COMMENT     ========================================================================\n';
    content += 'COMMENT     CodeXomics Action Manager - Execution Report\n';
    content += 'COMMENT     ========================================================================\n';
    content += `COMMENT     Execution ID: ${executionId}\n`;
    content += `COMMENT     Total Actions Executed: ${actions.length}\n`;
    content += `COMMENT     Execution Date: ${new Date().toISOString()}\n`;
    content += 'COMMENT     \n';

    actions.forEach((action, index) => {
      content += 'COMMENT     ------------------------------------------------------------------------\n';
      content += `COMMENT     Action ${index + 1}: ${action.type.replace(/_/g, ' ').toUpperCase()}\n`;
      content += `COMMENT       Action ID: ${action.id}\n`;
      content += `COMMENT       Target: ${action.target}\n`;
      content += `COMMENT       Description: ${action.details || 'N/A'}\n`;

      if (action.metadata?.start && action.metadata?.end) {
        content += `COMMENT       Position: ${action.metadata.start}-${action.metadata.end}\n`;
        content += `COMMENT       Length: ${action.metadata.end - action.metadata.start + 1} bp\n`;
      }
      if (action.metadata?.strand) {
        content += `COMMENT       Strand: ${action.metadata.strand}\n`;
      }
      if (action.executionStart) {
        content += `COMMENT       Executed: ${new Date(action.executionStart).toISOString()}\n`;
      }
      if (action.actualTime) {
        content += `COMMENT       Duration: ${action.actualTime}ms\n`;
      }

      if (action.result) {
        if (action.result.sequenceLength) {
          content += `COMMENT       Result Sequence Length: ${action.result.sequenceLength} bp\n`;
        }
        if (action.result.featuresCount !== undefined) {
          content += `COMMENT       Affected Features: ${action.result.featuresCount}\n`;
        }
      }

      content += 'COMMENT     \n';
    });

    content += 'COMMENT     ========================================================================\n';
    return content;
  }

  /**
   * Generate DEFINITION line
   */
  generateDefinition(chromosome, sourceFeatures, originalAnnotations) {
    const definition =
      sourceFeatures.note ||
      originalAnnotations.find(f => f.type === 'source')?.qualifiers?.note ||
      `${chromosome} - Modified by CodeXomics Action Manager`;
    return `DEFINITION  ${definition}\n`;
  }

  /**
   * Generate ACCESSION line with safe array handling
   */
  generateAccession(chromosome, sourceFeatures, originalAnnotations) {
    // Safe array handling - prevents "find is not a function" errors
    const dbXrefArray = Array.isArray(sourceFeatures.db_xref) ? sourceFeatures.db_xref : [];
    const originalDbXref = originalAnnotations.find(f => f.type === 'source')?.qualifiers?.db_xref;
    const originalDbXrefArray = Array.isArray(originalDbXref) ? originalDbXref : [];

    const accession =
      dbXrefArray.find(ref => ref.startsWith('taxon:'))?.replace('taxon:', '') ||
      originalDbXrefArray.find(ref => ref.startsWith('taxon:'))?.replace('taxon:', '') ||
      chromosome;

    return `ACCESSION   ${accession}\n`;
  }

  /**
   * Generate VERSION line
   */
  generateVersion(chromosome, sourceFeatures, originalAnnotations) {
    const dbXrefArray = Array.isArray(sourceFeatures.db_xref) ? sourceFeatures.db_xref : [];
    const originalDbXref = originalAnnotations.find(f => f.type === 'source')?.qualifiers?.db_xref;
    const originalDbXrefArray = Array.isArray(originalDbXref) ? originalDbXref : [];

    const version =
      dbXrefArray.find(ref => ref.startsWith('taxon:'))?.replace('taxon:', '') ||
      originalDbXrefArray.find(ref => ref.startsWith('taxon:'))?.replace('taxon:', '') ||
      chromosome;

    return `VERSION     ${version}\n`;
  }

  /**
   * Generate KEYWORDS line
   */
  generateKeywords(sourceFeatures, originalAnnotations) {
    const keywords =
      sourceFeatures.serotype ||
      sourceFeatures.serovar ||
      originalAnnotations.find(f => f.type === 'source')?.qualifiers?.serotype ||
      originalAnnotations.find(f => f.type === 'source')?.qualifiers?.serovar ||
      'genome editing, sequence modification';
    return `KEYWORDS    ${keywords}\n`;
  }

  /**
   * Generate SOURCE and ORGANISM lines
   */
  generateSource(sourceFeatures, originalAnnotations) {
    const organism =
      sourceFeatures.organism ||
      originalAnnotations.find(f => f.type === 'source')?.qualifiers?.organism ||
      'Unknown organism';
    const strain =
      sourceFeatures.strain || originalAnnotations.find(f => f.type === 'source')?.qualifiers?.strain || '';

    let content = 'SOURCE      .\n';
    content += `  ORGANISM  ${organism}\n`;

    if (strain) content += `            strain=${strain}\n`;
    if (sourceFeatures.host) content += `            host=${sourceFeatures.host}\n`;
    if (sourceFeatures.country) content += `            country=${sourceFeatures.country}\n`;
    if (sourceFeatures.collection_date) content += `            collection_date=${sourceFeatures.collection_date}\n`;

    return content;
  }

  /**
   * Generate FEATURES section
   */
  generateFeatures(chromosome, sequence, features, sourceFeatures) {
    const organism = sourceFeatures.organism || 'Unknown organism';
    const strain = sourceFeatures.strain || '';

    let content = 'FEATURES             Location/Qualifiers\n';

    // Source feature first
    content += `     source          1..${sequence.length}\n`;
    content += `                     /organism="${organism}"\n`;
    content += '                     /mol_type="genomic DNA"\n';
    if (strain) content += `                     /strain="${strain}"\n`;
    if (sourceFeatures.host) content += `                     /host="${sourceFeatures.host}"\n`;
    if (sourceFeatures.country) content += `                     /country="${sourceFeatures.country}"\n`;
    if (sourceFeatures.collection_date)
      content += `                     /collection_date="${sourceFeatures.collection_date}"\n`;
    if (sourceFeatures.isolation_source)
      content += `                     /isolation_source="${sourceFeatures.isolation_source}"\n`;

    // All other features
    if (features && features.length > 0) {
      features.forEach(feature => {
        if (feature.type === 'source') return;

        const location = this.formatLocation(feature);
        content += `     ${feature.type.padEnd(16)} ${location}\n`;

        if (feature.qualifiers) {
          Object.entries(feature.qualifiers).forEach(([key, value]) => {
            if (value === true) {
              content += `                     /${key}\n`;
            } else if (value && value !== '') {
              const valueStr = String(value);
              if (valueStr.length > 60) {
                const lines = this.wrapQualifierValue(valueStr, 60);
                lines.forEach((line, index) => {
                  if (index === 0) {
                    content += `                     /${key}="${line}"\n`;
                  } else {
                    content += `                     "${line}"\n`;
                  }
                });
              } else {
                content += `                     /${key}="${valueStr}"\n`;
              }
            }
          });
        }
      });
    }

    return content;
  }

  /**
   * Format feature location (handles strand orientation)
   */
  formatLocation(feature) {
    if (feature.strand === -1 || feature.strand === '-') {
      return `complement(${feature.start}..${feature.end})`;
    } else {
      return `${feature.start}..${feature.end}`;
    }
  }

  /**
   * Wrap long qualifier values into multiple lines
   */
  wrapQualifierValue(value, maxLength) {
    const lines = [];
    let currentLine = '';

    const words = value.split(' ');
    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxLength) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines;
  }

  /**
   * Generate ORIGIN section with formatted sequence
   */
  generateOrigin(sequence) {
    let content = 'ORIGIN\n';

    for (let i = 0; i < sequence.length; i += 60) {
      const lineNum = (i + 1).toString().padStart(9);
      const seqLine = sequence.substring(i, i + 60).toLowerCase();
      const formattedSeq = seqLine.match(/.{1,10}/g)?.join(' ') || seqLine;
      content += `${lineNum} ${formattedSeq}\n`;
    }

    return content;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenBankExporter;
}
if (typeof window !== 'undefined') {
  window.GenBankExporter = GenBankExporter;
}
