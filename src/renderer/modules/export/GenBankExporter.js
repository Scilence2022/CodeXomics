const GENBANK_POSITION_QUALIFIERS = new Set(['transl_except', 'anticodon', 'rpt_unit_range']);
const GENBANK_CDS_REVIEW_QUALIFIERS = [
  'transl_except',
  'exception',
  'ribosomal_slippage',
  'trans_splicing',
  'artificial_location',
  'pseudo',
  'pseudogene',
];

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

  static hasPositionQualifiers(feature) {
    return Object.keys(feature.qualifiers || {}).some(key => GENBANK_POSITION_QUALIFIERS.has(key.toLowerCase()));
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

    const sourceRecord = this.genomeBrowser.genbankRecords?.get(chromosome);
    if (sourceRecord?.sequence === sequence) {
      if (sourceRecord.accessions.length) {
        const lines = this.wrapQualifierValue(sourceRecord.accessions.join(' '), 67);
        content += `ACCESSION   ${lines.join('\n            ')}\n`;
      }
      if (sourceRecord.version) content += `VERSION     ${sourceRecord.version}\n`;
    }

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
      let qualifiers = this.getExportQualifiers(feature) || {
        gene: feature.name,
        product: feature.product,
        note: feature.note,
      };
      if (Object.hasOwn(feature, 'genbankCdsTranslationBeforeEdit')) {
        qualifiers = { ...qualifiers, translation: this.validateEditedCds(sequence, feature) };
      }
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
    if (feature.genbankLocationCoordinateError) throw new RangeError(feature.genbankLocationCoordinateError);
    const negative = feature.strand === -1 || feature.strand === '-';
    const original = feature.genbankLocation || feature.location;
    const bounds = feature.genbankLocationBounds;
    const compound = typeof original === 'string' && /\b(?:join|order)\(|[:^]/i.test(original);
    if (typeof original === 'string' && Array.isArray(bounds)) {
      const shift = this.getUniformLocationShift(feature);
      if (shift === 0) {
        return original.replace(/\s+/g, '');
      }
      if (shift !== null && !/[<>:]/.test(original)) {
        return original.replace(/\s+/g, '').replace(/\d+/g, value => String(Number(value) + shift));
      }
      if (/[<>]/.test(original)) {
        throw new RangeError(`Cannot export edited fuzzy location for ${feature.name || feature.type}: ${original}`);
      }
      if (compound) {
        throw new RangeError(`Cannot export edited compound location for ${feature.name || feature.type}: ${original}`);
      }
      if (feature.genbankLocationEdited && feature.type?.toLowerCase() === 'cds') {
        throw new RangeError(`Cannot export edited CDS boundary for ${feature.name || feature.type}: ${original}`);
      }
    }
    const formatSpan = (start, end) => (start === end ? String(start) : `${start}..${end}`);
    const span =
      Array.isArray(feature.segments) && feature.segments.length > 1
        ? `join(${feature.segments.map(segment => formatSpan(segment.start, segment.end)).join(',')})`
        : formatSpan(feature.start, feature.end);
    return negative ? `complement(${span})` : span;
  }

  getUniformLocationShift(feature) {
    if (!Array.isArray(feature.genbankLocationBounds) || feature.genbankLocationEdited) return null;
    const [start, end, strand] = feature.genbankLocationBounds;
    const negative = value => value === -1 || value === '-';
    const shift = feature.start - start;
    return negative(strand) === negative(feature.strand) && Number.isSafeInteger(shift) && feature.end - end === shift
      ? shift
      : null;
  }

  getExportQualifiers(feature) {
    const { qualifiers } = feature;
    if (feature.genbankQualifierCoordinateError) throw new SyntaxError(feature.genbankQualifierCoordinateError);
    if (!GenBankExporter.hasPositionQualifiers(feature)) {
      return qualifiers;
    }
    const shift = this.getUniformLocationShift(feature);
    if (shift === 0 || (!feature.genbankLocationBounds && !feature.genbankLocationEdited)) return qualifiers;
    if (shift === null) {
      throw new SyntaxError(`Cannot export coordinate qualifiers for edited feature ${feature.name || feature.type}`);
    }
    return this.mapPositionQualifiers(qualifiers, (start, end) => [start + shift, end + shift]);
  }

  mapLocalLocation(expression, mapSpan, mapGroup, mapRemote, depth = 0) {
    if (depth > 32) throw new SyntaxError('GenBank location nesting exceeds the supported limit');
    const span = /^[<>]?(\d+)(?:\.\.[<>]?(\d+))?$/.exec(expression);
    if (span) return mapSpan(Number(span[1]), Number(span[2] || span[1]), expression);
    const remote = /^([a-z][a-z0-9_.]*):([<>]?\d+(?:\.\.[<>]?\d+|\^\d+)?)$/i.exec(expression);
    if (mapRemote && remote) {
      return mapRemote(remote[1], remote[2], expression);
    }

    const operator = /^(join|order|complement)\((.+)\)$/i.exec(expression);
    if (!operator) throw new SyntaxError(`Cannot extract local sequence for location: ${expression}`);
    const [, type, body] = operator;

    const parts = [];
    let nesting = 0;
    let start = 0;
    for (let index = 0; index < body.length; index++) {
      if (body[index] === '(') nesting++;
      if (body[index] === ')') nesting--;
      if (nesting < 0) throw new SyntaxError(`Invalid GenBank location: ${expression}`);
      if (body[index] === ',' && nesting === 0) {
        parts.push(body.slice(start, index));
        start = index + 1;
      }
    }
    if (nesting !== 0 || (type.toLowerCase() === 'complement' && parts.length)) {
      throw new SyntaxError(`Invalid GenBank location: ${expression}`);
    }
    parts.push(body.slice(start));
    return mapGroup(
      type,
      parts.map(part => this.mapLocalLocation(part, mapSpan, mapGroup, mapRemote, depth + 1))
    );
  }

  mapEditableLocation(expression, mapSpan, { allowFuzzy, preserveRemote }) {
    return this.mapLocalLocation(
      expression.replace(/\s+/g, ''),
      (start, end, span) => {
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) {
          throw new SyntaxError(`Invalid GenBank location: ${span}`);
        }
        const range = span.includes('..');
        const [left, right] = span.split('..');
        if (range && (left.startsWith('>') || right.startsWith('<'))) {
          throw new SyntaxError(`Unsupported fuzzy boundary: ${span}`);
        }
        const partialStart = left.startsWith('<');
        const partialEnd = (range ? right : left).startsWith('>');
        if (!allowFuzzy && (partialStart || partialEnd)) throw new SyntaxError(`Unsupported fuzzy coordinate: ${span}`);
        const [first, last] = mapSpan(start, end, partialStart, partialEnd);
        if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first) {
          throw new RangeError(`Invalid remapped GenBank location: ${span}`);
        }
        const startMarker = left.match(/^[<>]/)?.[0] || '';
        return range ? `${startMarker}${first}..${partialEnd ? '>' : ''}${last}` : `${startMarker}${first}`;
      },
      (type, parts) => `${type}(${parts.join(',')})`,
      preserveRemote ? (_accession, _span, original) => original : undefined
    );
  }

  getLocalDisplaySegments(location) {
    const segments = [];
    try {
      this.mapLocalLocation(
        location.replace(/\s+/g, ''),
        (start, end) => {
          if (start > 0 && end >= start) segments.push({ start, end });
        },
        () => undefined,
        () => undefined
      );
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return [];
    }
    return segments;
  }

  mapPositionQualifiers(qualifiers, mapSpan, allowFuzzy = false) {
    let result;
    const locationOptions = { allowFuzzy, preserveRemote: true };
    for (const [key, raw] of Object.entries(qualifiers || {})) {
      const name = key.toLowerCase();
      if (!GENBANK_POSITION_QUALIFIERS.has(name)) continue;
      const remap = value => {
        try {
          if (typeof value !== 'string') throw new SyntaxError('Expected a coordinate string');
          if (name === 'rpt_unit_range') return this.mapEditableLocation(value, mapSpan, locationOptions);
          const match = /^(\(\s*pos\s*:\s*)(.+?)(\s*,\s*aa\s*:.*\))$/is.exec(value);
          if (!match) throw new SyntaxError('Expected a position followed by an amino acid');
          const [, prefix, location, suffix] = match;
          return prefix + this.mapEditableLocation(location, mapSpan, locationOptions) + suffix;
        } catch (error) {
          if (!(error instanceof SyntaxError || error instanceof RangeError)) throw error;
          throw new SyntaxError(`Cannot remap /${key}: ${error.message}`, { cause: error });
        }
      };
      result ||= { ...qualifiers };
      result[key] = Array.isArray(raw) ? raw.map(remap) : remap(raw);
    }
    return result || qualifiers;
  }

  remapLocationForEdit(feature, modification) {
    if (feature.genbankLocationCoordinateError) return feature;
    if (!['insert', 'delete', 'replace'].includes(modification.type)) return null;
    const insertion = modification.type === 'insert';
    const position = insertion ? modification.position : modification.start;
    const editEnd = insertion ? position : modification.end;
    const removed = insertion ? 0 : editEnd - position + 1;
    const added = insertion
      ? (modification.sequence?.length ?? modification.length)
      : (modification.newSequence?.length ?? modification.newLength ?? 0);
    const delta = added - removed;
    if (!Number.isSafeInteger(position) || position < 1 || !Number.isSafeInteger(editEnd) || editEnd < position) {
      return null;
    }
    if (!Number.isSafeInteger(added) || added < 0) return null;

    const original = feature.genbankLocation || feature.location;
    const requiresReview = /[<>:]/.test(original);
    if (original.includes('^') && !requiresReview) return null;
    if (!requiresReview && this.getUniformLocationShift(feature) === null) return null;
    const segments = [];
    let minStart = Infinity;
    let maxEnd = 0;
    let editedInterior = false;
    const remapSpan = (start, end, partialStart, partialEnd) => {
      const possibleEnd = partialEnd ? Infinity : end;
      const overlaps = insertion
        ? (partialStart || position > start) && position <= possibleEnd
        : (partialStart || editEnd >= start) && position <= possibleEnd;
      if (overlaps) {
        const reason = partialStart || partialEnd ? 'Edit may overlap fuzzy coordinate' : 'Edit overlaps coordinate';
        throw new RangeError(`${reason} ${start}..${end}`);
      }
      const shift = (insertion ? start >= position : start > editEnd) ? delta : 0;
      return [start + shift, end + shift];
    };
    let location;
    let remapped;
    try {
      location = this.formatLocation(feature);
      remapped = this.mapEditableLocation(
        location,
        (start, end, partialStart, partialEnd) => {
          let mapped;
          if (!requiresReview && start < position && (insertion ? position <= end : editEnd < end)) {
            if (editedInterior) throw new RangeError('Edit overlaps more than one feature segment');
            editedInterior = true;
            mapped = [start, end + delta];
          } else {
            mapped = remapSpan(start, end, partialStart, partialEnd);
          }
          const [first, last] = mapped;
          minStart = Math.min(minStart, first);
          maxEnd = Math.max(maxEnd, last);
          segments.push({ start: first, end: last });
          return [first, last];
        },
        { allowFuzzy: true, preserveRemote: true }
      );
    } catch (error) {
      if (!(error instanceof SyntaxError || error instanceof RangeError)) throw error;
      if (requiresReview) {
        return {
          ...feature,
          genbankLocationCoordinateError: `Cannot export edited location for ${feature.name || feature.type}: ${error.message}`,
        };
      }
      return null;
    }
    if (segments.length === 0) return feature; // All segments belong to other records.
    if (remapped === location && position > maxEnd && !GenBankExporter.hasPositionQualifiers(feature)) return feature;
    let qualifiers = feature.qualifiers;
    let qualifierError;
    try {
      qualifiers = this.mapPositionQualifiers(this.getExportQualifiers(feature), remapSpan, true);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      qualifierError = error.message;
    }
    if (!editedInterior && remapped === location && !qualifierError && qualifiers === feature.qualifiers) {
      return feature;
    }
    const remappedFeature = {
      ...feature,
      start: minStart,
      end: maxEnd,
      segments,
      location: remapped,
      genbankLocation: remapped,
      genbankLocationBounds: [minStart, maxEnd, feature.strand],
      genbankLocationSpan: [minStart, maxEnd],
      qualifiers,
      ...(original.includes(':') ? { genbankLocalSegments: segments } : {}),
      ...(qualifierError ? { genbankQualifierCoordinateError: qualifierError } : {}),
    };
    if (editedInterior && feature.type?.toLowerCase() === 'cds') {
      remappedFeature.genbankCdsTranslationBeforeEdit = Object.hasOwn(feature, 'genbankCdsTranslationBeforeEdit')
        ? feature.genbankCdsTranslationBeforeEdit
        : (feature.qualifiers?.translation ?? null);
      remappedFeature.qualifiers = { ...qualifiers };
      delete remappedFeature.qualifiers.translation;
      delete remappedFeature.genbankLegacyTranslation;
    }
    return remappedFeature;
  }

  validateEditedCds(sequence, feature) {
    const qualifiers = this.getExportQualifiers(feature) || {};
    const previous = feature.genbankCdsTranslationBeforeEdit;
    const review = reason =>
      new Error(`Cannot export edited CDS ${feature.name || feature.type}: ${reason}. Annotation review is required.`);
    const table = Number(qualifiers.transl_table ?? 1);
    if (
      typeof previous !== 'string' ||
      !/^[A-Z]+\*?$/.test(previous.replace(/\s+/g, '')) ||
      ![1, 11].includes(table) ||
      Number(qualifiers.codon_start ?? 1) !== 1 ||
      GENBANK_CDS_REVIEW_QUALIFIERS.some(key => Object.hasOwn(qualifiers, key))
    ) {
      throw review('the original translation or translation settings cannot be verified');
    }
    const node = typeof module !== 'undefined' && module.exports;
    const processing = node ? require('../UnifiedSequenceProcessing') : window.UnifiedSequenceProcessing;
    const translator = node ? require('../UnifiedDNATranslation') : window.UnifiedDNATranslation;
    const bases = this.extractLocationSequence(
      sequence,
      feature,
      value => processing.reverseComplement(value, { caseSensitive: false, validateInput: false }).sequence
    ).toUpperCase();
    if (bases.length % 3 !== 0 || !/^ATG[ACGT]*(?:TAA|TAG|TGA)$/.test(bases)) {
      throw review('the edited sequence is not a complete unambiguous CDS with an ATG start and a terminal stop');
    }
    // Tables 1 and 11 have identical codon assignments with an ATG start.
    const result = translator.translateDNA({ sequence: bases, geneticCode: 'standard', includeStops: true });
    if (!result.success || result.protein !== previous.replace(/\s+/g, '').replace(/\*$/, '') + '*') {
      throw review('the edited sequence changes the annotated protein');
    }
    return result.protein.slice(0, -1);
  }

  getLoadedReferenceSequence(accession) {
    const identifier = accession.toUpperCase();
    const versioned = /\.\d+$/.test(identifier);
    const matches = [];
    for (const record of this.genomeBrowser.genbankRecords?.values() || []) {
      const matchesIdentifier = versioned
        ? record.version?.toUpperCase() === identifier
        : record.accessions.some(value => value.toUpperCase() === identifier);
      if (matchesIdentifier) matches.push(record.sequence);
    }
    if (matches.length !== 1) {
      const reason = matches.length ? 'multiple loaded records match' : 'the referenced record is unavailable';
      throw new Error(`Cannot extract local sequence for reference ${accession}: ${reason}`);
    }
    return matches[0];
  }

  extractLocationSequence(sequence, feature, reverseComplement) {
    const extract = (location, bases) =>
      this.mapLocalLocation(
        location,
        (start, end, expression) => {
          if (start < 1 || end < start || end > bases.length) throw new Error(`Out-of-range location: ${expression}`);
          return bases.slice(start - 1, end);
        },
        (type, parts) => {
          if (type.toLowerCase() === 'complement') return reverseComplement(parts[0]);
          if (type.toLowerCase() === 'join') return parts.join('');
          throw new Error('Cannot extract local sequence for an order location');
        },
        (accession, span) => extract(span, this.getLoadedReferenceSequence(accession))
      );
    return extract(this.formatLocation(feature), sequence);
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
