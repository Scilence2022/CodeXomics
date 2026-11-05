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
    const { chromosome, sequence, features, actions, executionId, options = {} } = params;

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
    content += this.generateFeatures(chromosome, sequence, features, sourceFeatures, options);

    // ORIGIN section (sequence data)
    if (options.includeSequence !== false) content += this.generateOrigin(sequence);

    // End marker
    content += '//\n';

    return content;
  }

  /**
   * Generate LOCUS line
   */
  generateLocus(chromosome, sequence, sourceFeatures, originalAnnotations) {
    const isCircular =
      sourceFeatures.topology === 'circular' ||
      sourceFeatures.mol_type?.includes('circular') ||
      originalAnnotations.find(f => f.type === 'source' && f.qualifiers?.mol_type?.includes('circular')) ||
      false;
    const topology = (isCircular ? 'circular' : 'linear').padEnd(8);
    const [year, month, day] = new Date().toISOString().slice(0, 10).split('-');
    const monthName = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][
      Number(month) - 1
    ];
    const nameAndLength = chromosome.padEnd(Math.max(chromosome.length, 27 - String(sequence.length).length));

    return `LOCUS       ${nameAndLength} ${sequence.length} bp    DNA     ${topology} UNK ${day}-${monthName}-${year}\n`;
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
  generateFeatures(_chromosome, sequence, features, sourceFeatures, options = {}) {
    const list = features || [];
    const source = {
      type: 'source',
      start: 1,
      end: sequence.length,
      qualifiers: {
        organism: sourceFeatures.organism || 'Unknown organism',
        mol_type: sourceFeatures.mol_type || 'genomic DNA',
        strain: sourceFeatures.strain,
        host: sourceFeatures.host,
        country: sourceFeatures.country,
        collection_date: sourceFeatures.collection_date,
        isolation_source: sourceFeatures.isolation_source,
      },
    };
    let content = 'FEATURES             Location/Qualifiers\n';
    const exportFeatures = list.filter(feature => !['primer', 'primer_bind'].includes(feature.type?.toLowerCase()));
    if (!exportFeatures.some(feature => feature.type?.toLowerCase() === 'source')) exportFeatures.unshift(source);
    for (const feature of exportFeatures) {
      const location = this.formatLocation(feature);
      const locationLines = [];
      let line = '';
      for (const part of location.match(/[^,]+,?/g) || [location]) {
        if (line && line.length + part.length > 59) {
          locationLines.push(line);
          line = '';
        }
        line += part;
      }
      locationLines.push(line);
      content += `     ${feature.type.padEnd(15)} ${locationLines.join('\n                     ')}\n`;
      const qualifiers = feature.qualifiers || { gene: feature.name, product: feature.product, note: feature.note };
      for (const [key, raw] of Object.entries(qualifiers)) {
        if (key === 'translation' && options.includeProteinSequences === false) continue;
        for (const value of Array.isArray(raw) ? raw : [raw]) {
          content += this.formatQualifier(key, value);
        }
      }
    }
    return content;
  }

  formatQualifier(key, value) {
    const indent = '                     ';
    if (value === true) return `${indent}/${key}\n`;
    if (value == null || value === false) return '';
    const text = String(value)
      .replace(/[\r\n]+/g, ' ')
      .replace(/"+/g, quotes => (quotes.length % 2 ? quotes + '"' : quotes));
    const lines = key === 'translation' ? text.match(/.{1,58}/g) || [''] : this.wrapQualifierValue(text, 58);
    return `${indent}/${key}="${lines.join(`\n${indent}`)}"\n`;
  }

  formatLocation(feature) {
    const negative = feature.strand === -1 || feature.strand === '-';
    const original = feature.genbankLocation || feature.location;
    const bounds = feature.genbankLocationBounds;
    const compound = typeof original === 'string' && /\b(?:join|order)\(|[:^]/i.test(original);
    if (typeof original === 'string' && Array.isArray(bounds)) {
      const [start, end, strand] = bounds;
      const shift = feature.start - start;
      const sameStrand = negative === (strand === -1 || strand === '-');
      if (sameStrand && shift === 0 && feature.end === end && !feature.genbankLocationEdited) {
        return original.replace(/\s+/g, '');
      }
      if (
        sameStrand &&
        Number.isSafeInteger(shift) &&
        feature.end - end === shift &&
        !feature.genbankLocationEdited &&
        !original.includes(':')
      ) {
        return original.replace(/\s+/g, '').replace(/\d+/g, value => String(Number(value) + shift));
      }
      if (compound) {
        throw new Error(`Cannot export edited compound location for ${feature.name || feature.type}: ${original}`);
      }
    }
    const formatSpan = (start, end) => (start === end ? String(start) : `${start}..${end}`);
    const span =
      Array.isArray(feature.segments) && feature.segments.length > 1
        ? `join(${feature.segments.map(segment => formatSpan(segment.start, segment.end)).join(',')})`
        : formatSpan(feature.start, feature.end);
    return negative ? `complement(${span})` : span;
  }

  extractLocationSequence(sequence, feature, reverseComplement) {
    const location = this.formatLocation(feature);
    const extract = (expression, depth = 0) => {
      if (depth > 32) throw new Error('GenBank location nesting exceeds the supported limit');
      const simple = /^[<>]?(\d+)(?:\.\.[<>]?(\d+))?$/.exec(expression);
      if (simple) {
        const start = Number(simple[1]);
        const end = Number(simple[2] || simple[1]);
        if (start < 1 || end < start || end > sequence.length) throw new Error(`Out-of-range location: ${expression}`);
        return sequence.slice(start - 1, end);
      }

      const operator = /^(join|complement)\((.+)\)$/i.exec(expression);
      if (!operator) throw new Error(`Cannot extract local sequence for location: ${expression}`);
      const [, type, body] = operator;
      if (type.toLowerCase() === 'complement') return reverseComplement(extract(body, depth + 1));

      const parts = [];
      let nesting = 0;
      let start = 0;
      for (let index = 0; index < body.length; index++) {
        if (body[index] === '(') nesting++;
        if (body[index] === ')') nesting--;
        if (body[index] === ',' && nesting === 0) {
          parts.push(body.slice(start, index));
          start = index + 1;
        }
      }
      if (nesting !== 0) throw new Error(`Invalid GenBank location: ${expression}`);
      parts.push(body.slice(start));
      return parts.map(part => extract(part, depth + 1)).join('');
    };
    return extract(location);
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
