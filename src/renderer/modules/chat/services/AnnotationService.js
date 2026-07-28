// @ts-check

const GENE_ANNOTATION_FEATURE_TYPES = Object.freeze([
  'CDS',
  'gene',
  'mRNA',
  'tRNA',
  'rRNA',
  'ncRNA',
  'tmRNA',
  'misc_RNA',
  'precursor_RNA',
  'miRNA',
  'snRNA',
  'snoRNA',
  'antisense_RNA',
  'guide_RNA',
  'telomerase_RNA',
  'RNase_P_RNA',
  'RNase_MRP_RNA',
  'pseudogene',
]);

const GENE_ANNOTATION_TYPE_PRIORITY = Object.freeze({
  CDS: 100,
  TRNA: 90,
  RRNA: 90,
  NCRNA: 90,
  TMRNA: 90,
  MISC_RNA: 90,
  PRECURSOR_RNA: 90,
  MIRNA: 90,
  SNRNA: 90,
  SNORNA: 90,
  ANTISENSE_RNA: 90,
  GUIDE_RNA: 90,
  TELOMERASE_RNA: 90,
  RNASE_P_RNA: 90,
  RNASE_MRP_RNA: 90,
  MRNA: 80,
  PSEUDOGENE: 70,
  GENE: 10,
});

/**
 * AnnotationService - Handles annotation-related operations extracted from ChatManager
 */
class AnnotationService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
    this.changeSetService =
      typeof window.AnnotationChangeSetService === 'function'
        ? new window.AnnotationChangeSetService(app, chatManager, this)
        : null;
  }

  // Helper method extracted from ChatManager
  _getChangeTracker() {
    return this.chatManager._getChangeTracker();
  }

  _getChangeSetService() {
    if (!this.changeSetService && typeof window.AnnotationChangeSetService === 'function') {
      this.changeSetService = new window.AnnotationChangeSetService(this.app, this.chatManager, this);
    }
    if (!this.changeSetService) {
      throw new Error('Annotation ChangeSet service is unavailable');
    }
    return this.changeSetService;
  }

  async resolveAnnotationTarget(params) {
    return this._getChangeSetService().resolveAnnotationTarget(params);
  }

  async restoreCommittedAnnotationOverlay() {
    return this._getChangeSetService().restoreCommittedAnnotationOverlay();
  }

  async createAnnotationChangeset(params) {
    return this._getChangeSetService().createAnnotationChangeset(params);
  }

  async getAnnotationChangeset(params) {
    return this._getChangeSetService().getAnnotationChangeset(params);
  }

  async listAnnotationChangesets(params) {
    return this._getChangeSetService().listAnnotationChangesets(params);
  }

  async requestAnnotationApproval(params) {
    return this._getChangeSetService().requestAnnotationApproval(params);
  }

  async rejectAnnotationChangeset(params) {
    return this._getChangeSetService().rejectAnnotationChangeset(params);
  }

  async applyAnnotationChangeset(params) {
    return this._getChangeSetService().applyAnnotationChangeset(params);
  }

  async rollbackAnnotationChangeset(params) {
    return this._getChangeSetService().rollbackAnnotationChangeset(params);
  }

  async getAnnotationAudit(params) {
    return this._getChangeSetService().getAnnotationAudit(params);
  }

  // 1. ANNOTATION SEARCH AND RETRIEVAL
  async listAnnotations(params) {
    const { chromosome, chrom, chr: chrAlias, start, begin, end, stop, type, limit = 100, offset = 0 } = params;

    const targetChr = chromosome || chrom || chrAlias || this.app.currentChromosome;
    const targetStart = start !== undefined ? start : begin !== undefined ? begin : null;
    const targetEnd = end !== undefined ? end : stop !== undefined ? stop : null;

    if (!this.app.currentAnnotations) {
      throw new Error('No annotations loaded');
    }

    const chr = targetChr;
    const annotations = chr
      ? this.app.currentAnnotations[chr] || []
      : Object.values(this.app.currentAnnotations).flat();

    let filtered = annotations;

    // Filter by region
    if (targetStart !== null && targetEnd !== null) {
      filtered = filtered.filter(a => a.start <= targetEnd && a.end >= targetStart);
    }

    // Filter by type
    if (type) {
      filtered = filtered.filter(a => a.type && a.type.toLowerCase() === type.toLowerCase());
    }

    const total = filtered.length;
    const paged = limit > 0 ? filtered.slice(offset, offset + limit) : filtered;

    return {
      success: true,
      chromosome: chr || 'all',
      total,
      offset,
      limit,
      count: paged.length,
      annotations: paged.map(a => ({
        id: a.id,
        type: a.type,
        start: a.start,
        end: a.end,
        strand: a.strand,
        locus_tag: a.qualifiers?.locus_tag || null,
        gene: a.qualifiers?.gene || null,
        product: a.qualifiers?.product || null,
      })),
    };
  }

  /**
   * Find annotation by identifier (gene name, locus tag, or protein ID)
   */
  _findAnnotation(identifier, chromosome) {
    const targetIdentifier = Array.isArray(identifier) ? identifier[0] : identifier;
    const chromosomes = chromosome ? [chromosome] : Object.keys(this.app.currentAnnotations);

    for (const chr of chromosomes) {
      const annotations = this.app.currentAnnotations[chr];
      if (!annotations) {
        continue;
      }

      for (const annotation of annotations) {
        const qualifiers = annotation.qualifiers || {};
        const identifiers = [
          annotation.id,
          annotation.name,
          qualifiers.gene,
          qualifiers.gene_name,
          qualifiers.locus_tag,
          qualifiers.protein_id,
          qualifiers.ID,
          qualifiers.Name,
          qualifiers.gene_id,
          qualifiers.transcript_id,
          qualifiers.Alias,
        ]
          .flat()
          .flatMap(value => String(value || '').split(','))
          .map(value => value.trim())
          .filter(Boolean);

        if (identifiers.includes(String(targetIdentifier))) {
          return {
            chromosome: chr,
            annotation: annotation,
          };
        }
      }
    }

    return null;
  }

  async getAnnotation(params) {
    const identifier =
      params.identifier ||
      params.annotationId ||
      params.gene ||
      params.gene_name ||
      params.geneName ||
      params.locus_tag ||
      params.locusTag;
    const chromosome = params.chromosome || params.chrom || params.chr || this.app.currentChromosome;

    if (!this.app.currentAnnotations) {
      throw new Error('No annotations loaded');
    }

    const found = this._findAnnotation(identifier, chromosome);
    if (!found) {
      throw new Error(`Annotation "${identifier}" not found`);
    }

    const a = found.annotation;
    return {
      success: true,
      identifier,
      chromosome: found.chromosome,
      annotation: params.full_details
        ? a
        : {
            id: a.id,
            type: a.type,
            start: a.start,
            end: a.end,
            strand: a.strand,
            qualifiers: a.qualifiers || {},
            length: a.end - a.start + 1,
          },
    };
  }

  async searchAnnotations(params) {
    const { query, chromosome, type, fields, limit = 50 } = params;

    if (!this.app.currentAnnotations) {
      throw new Error('No annotations loaded');
    }

    const lowerQuery = query.toLowerCase();
    const searchFields = fields || ['product', 'gene', 'note', 'locus_tag', 'db_xref', 'protein_id', 'EC_number'];
    const results = [];

    const chromosomes = chromosome ? [chromosome] : Object.keys(this.app.currentAnnotations);

    for (const chr of chromosomes) {
      const annotations = this.app.currentAnnotations[chr] || [];
      for (const a of annotations) {
        if (type && a.type && a.type.toLowerCase() !== type.toLowerCase()) continue;

        let matched = false;
        const matchedFields = [];

        for (const field of searchFields) {
          const val = a.qualifiers?.[field];
          if (val && String(val).toLowerCase().includes(lowerQuery)) {
            matched = true;
            matchedFields.push(field);
          }
        }

        if (matched) {
          results.push({
            chromosome: chr,
            id: a.id,
            type: a.type,
            start: a.start,
            end: a.end,
            strand: a.strand,
            locus_tag: a.qualifiers?.locus_tag || null,
            gene: a.qualifiers?.gene || null,
            product: a.qualifiers?.product || null,
            matchedFields,
          });
        }

        if (limit > 0 && results.length >= limit) break;
      }
      if (limit > 0 && results.length >= limit) break;
    }

    return {
      success: true,
      query,
      total: results.length,
      results,
    };
  }

  _qualityFeatureType(value) {
    return String(value || '')
      .trim()
      .toUpperCase();
  }

  _qualityValues(qualifiers, names) {
    const result = [];
    const seen = new Set();
    for (const name of names) {
      const raw = qualifiers?.[name];
      const values = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
      for (const value of values) {
        const text = String(value || '').trim();
        const key = text.toLowerCase();
        if (!text || seen.has(key)) continue;
        seen.add(key);
        result.push(text);
      }
    }
    return result;
  }

  _qualityPrimary(qualifiers, names) {
    return this._qualityValues(qualifiers, names)[0] || null;
  }

  _qualityIdentities(annotation) {
    const qualifiers = annotation?.qualifiers || {};
    return this._qualityValues(qualifiers, [
      'locus_tag',
      'locusTag',
      'protein_id',
      'proteinId',
      'gene',
      'gene_name',
      'Name',
      'ID',
      'gene_id',
      'transcript_id',
    ]).map(value => value.toLowerCase());
  }

  _qualityLocusTags(annotation) {
    return this._qualityValues(annotation?.qualifiers || {}, ['locus_tag', 'locusTag']).map(value =>
      value.toLowerCase()
    );
  }

  _qualityTypePriority(type) {
    return GENE_ANNOTATION_TYPE_PRIORITY[this._qualityFeatureType(type)] || 0;
  }

  _isSupportedGeneAnnotationType(type) {
    return this._qualityTypePriority(type) > 0;
  }

  _qualityBand(score) {
    if (score < 30) return { qualityBand: 'critical', priority: 'critical' };
    if (score < 50) return { qualityBand: 'low', priority: 'high' };
    if (score < 75) return { qualityBand: 'medium', priority: 'medium' };
    return { qualityBand: 'high', priority: 'low' };
  }

  _assessAnnotationObject(annotation, chromosome) {
    const qualifiers = annotation?.qualifiers || {};
    const featureType = String(annotation?.type || 'unknown');
    const normalizedType = this._qualityFeatureType(featureType);
    const product = this._qualityPrimary(qualifiers, ['product', 'Product']);
    const locusTag = this._qualityPrimary(qualifiers, ['locus_tag', 'locusTag']);
    const gene = this._qualityPrimary(qualifiers, ['gene', 'gene_name', 'Gene', 'Name']);
    const proteinId = this._qualityPrimary(qualifiers, ['protein_id', 'proteinId']);
    const notes = this._qualityValues(qualifiers, ['note', 'Note', 'function', 'Function']);
    const dbXrefs = this._qualityValues(qualifiers, ['db_xref', 'dbXref', 'Dbxref']);
    const translation = this._qualityPrimary(qualifiers, ['translation', 'Translation']);
    const reasons = [];
    const missingFields = new Set();
    const recommendedResearchFocus = new Set();
    let deduction = 0;
    const addReason = (code, points, severity, message, fields, focus) => {
      deduction += points;
      for (const field of fields || []) missingFields.add(field);
      for (const item of focus || []) recommendedResearchFocus.add(item);
      reasons.push({ code, deduction: points, severity, message, fields: fields || [] });
    };

    const genericProduct =
      /^(?:(?:conserved\s+)?(?:hypothetical|uncharacteri[sz]ed|unknown|predicted)(?:\s+(?:protein|gene|gene product|rna))?|(?:protein|gene product|rna)(?:\s+of)?\s+unknown\s+function)$/i;
    const uncertainProduct = /^(?:putative|probable|predicted)\b/i;
    const productIsExpected = !['GENE', 'PSEUDOGENE'].includes(normalizedType);
    if (!product && productIsExpected) {
      addReason(
        'missing_product',
        30,
        'high',
        'The selected feature has no product qualifier.',
        ['product'],
        ['molecular function', 'standardized product']
      );
    } else if (product && genericProduct.test(product)) {
      addReason(
        'generic_product',
        30,
        'high',
        `The product qualifier is non-specific: ${product}`,
        ['product'],
        ['molecular function', 'standardized product', 'ortholog evidence']
      );
    } else if (product && uncertainProduct.test(product)) {
      addReason(
        'uncertain_product',
        8,
        'medium',
        `The product qualifier is explicitly uncertain: ${product}`,
        [],
        ['molecular function', 'ortholog evidence']
      );
    }

    if (!locusTag && !proteinId) {
      addReason(
        'missing_stable_accession',
        15,
        'high',
        'The feature has neither a locus tag nor a protein identifier.',
        ['locus_tag', 'protein_id'],
        ['gene identity', 'nomenclature']
      );
    }
    if (!gene) {
      addReason(
        'missing_gene_symbol',
        8,
        'medium',
        'The feature has no gene symbol or accepted gene name.',
        ['gene'],
        ['gene identity', 'nomenclature']
      );
    }
    if (notes.length === 0) {
      addReason(
        'missing_functional_note',
        15,
        'medium',
        'The feature has no functional annotation Note.',
        ['note'],
        ['physiological role', 'evidence and citations']
      );
    }
    if (dbXrefs.length === 0) {
      addReason(
        'missing_database_cross_references',
        10,
        'medium',
        'The feature has no external database cross-reference.',
        ['db_xref'],
        ['database cross-references']
      );
    }
    if (notes.length > 0 && !notes.some(note => /(?:PMID\s*:\s*\d+|doi\s*:\s*10\.\d{4,9}\/)/i.test(note))) {
      addReason(
        'missing_literature_citation',
        5,
        'low',
        'The functional Note has no recognizable PMID or DOI citation.',
        [],
        ['evidence and citations']
      );
    }

    if (normalizedType === 'CDS') {
      if (!proteinId) {
        addReason(
          'missing_protein_identifier',
          8,
          'medium',
          'The CDS has no protein identifier.',
          ['protein_id'],
          ['protein identity']
        );
      }
      if (!translation) {
        addReason(
          'missing_translation',
          12,
          'high',
          'The CDS has no translated amino-acid sequence.',
          ['translation'],
          ['coding sequence integrity']
        );
      } else if (translation.slice(0, -1).includes('*')) {
        addReason(
          'internal_stop_codon',
          25,
          'critical',
          'The CDS translation contains an internal stop codon.',
          ['translation'],
          ['coding sequence integrity', 'pseudogene status']
        );
      }
    } else if (normalizedType.includes('RNA')) {
      recommendedResearchFocus.add('RNA function');
      recommendedResearchFocus.add('RNA processing and structure');
    }

    const qualityScore = Math.max(0, Math.min(100, 100 - deduction));
    const band = this._qualityBand(qualityScore);
    return {
      schema: 'codexomics.annotation-quality-assessment.v1',
      policyVersion: 'codexomics.annotation-quality-policy.v1',
      chromosome,
      feature: {
        id: annotation?.id || null,
        featureType,
        start: annotation?.start ?? null,
        end: annotation?.end ?? null,
        strand: annotation?.strand ?? null,
        locusTag,
        gene,
        proteinId,
        product,
      },
      qualityScore,
      ...band,
      reasons,
      missingFields: Array.from(missingFields).sort(),
      recommendedResearchFocus: Array.from(recommendedResearchFocus),
    };
  }

  async assessAnnotationQuality(params = {}) {
    const identifier = params.identifier || params.annotationId || params.gene || params.locusTag;
    if (!identifier) throw new Error('assess_annotation_quality requires an annotation identifier');
    const resolved = await this.resolveAnnotationTarget(params);
    const target = resolved.target || {};
    const annotation = {
      id: resolved.annotation?.id || target.annotationId || null,
      type: target.featureType,
      start: target.coordinates?.start,
      end: target.coordinates?.end,
      strand: target.coordinates?.strand,
      qualifiers: resolved.annotation?.qualifiers || {},
    };
    return {
      success: true,
      target,
      assessment: this._assessAnnotationObject(annotation, target.chromosome),
    };
  }

  async listAnnotationQualityCandidates(params = {}) {
    if (!this.app.currentAnnotations) throw new Error('No annotations loaded');
    const requestedTypes =
      Array.isArray(params.featureTypes) && params.featureTypes.length > 0
        ? params.featureTypes
        : GENE_ANNOTATION_FEATURE_TYPES;
    const typeKeys = new Set(requestedTypes.map(type => this._qualityFeatureType(type)));
    const unsupported = Array.from(typeKeys).filter(type => !GENE_ANNOTATION_TYPE_PRIORITY[type]);
    if (unsupported.length > 0) {
      throw new Error(`Unsupported gene annotation feature type(s): ${unsupported.join(', ')}`);
    }
    const maximumQualityScore = params.maximumQualityScore === undefined ? 100 : Number(params.maximumQualityScore);
    if (!Number.isFinite(maximumQualityScore) || maximumQualityScore < 0 || maximumQualityScore > 100) {
      throw new Error('maximumQualityScore must be a number from 0 to 100');
    }
    const sortBy = String(params.sortBy || 'quality').toLowerCase();
    if (!['quality', 'coordinate'].includes(sortBy)) {
      throw new Error('sortBy must be either "quality" or "coordinate"');
    }
    const researchHistoryPolicy = String(params.researchHistoryPolicy || 'include').toLowerCase();
    if (!['include', 'exclude-active', 'exclude-completed', 'exclude-covered'].includes(researchHistoryPolicy)) {
      throw new Error(
        'researchHistoryPolicy must be "include", "exclude-active", "exclude-completed", or "exclude-covered"'
      );
    }
    const researchRefreshDays =
      params.researchRefreshDays === undefined || params.researchRefreshDays === null
        ? null
        : Number(params.researchRefreshDays);
    if (
      researchRefreshDays !== null &&
      (!Number.isInteger(researchRefreshDays) || researchRefreshDays < 1 || researchRefreshDays > 3650)
    ) {
      throw new Error('researchRefreshDays must be an integer from 1 to 3650 when provided');
    }
    const requestedLimit = params.limit === undefined ? 100 : Number(params.limit);
    const limit = Math.max(0, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 100, 100000));
    const offset = Math.max(0, Number(params.offset) || 0);
    const chromosomes = params.chromosome ? [params.chromosome] : Object.keys(this.app.currentAnnotations);
    const groups = [];
    const groupByIdentity = new Map();

    for (const chromosome of chromosomes) {
      for (const annotation of this.app.currentAnnotations[chromosome] || []) {
        if (!typeKeys.has(this._qualityFeatureType(annotation?.type))) continue;
        const location = `${chromosome}:${annotation.start}:${annotation.end}:${annotation.strand ?? ''}`;
        const identities = this._qualityIdentities(annotation);
        const locusTagKeys = this._qualityLocusTags(annotation).map(locusTag => `${chromosome}:locus-tag:${locusTag}`);
        // locus_tag identifies the biological locus, not an individual
        // GenBank feature row. Group gene/CDS records by that stable identity
        // even when a compound CDS location has multiple joined intervals.
        // If a malformed file reuses the tag for multiple CDS records, they
        // remain in one group and are rejected below as equally preferred.
        const keys = locusTagKeys.length > 0 ? locusTagKeys : identities.map(identity => `${location}:${identity}`);
        let group = keys.map(key => groupByIdentity.get(key)).find(Boolean);
        if (!group) {
          group = { chromosome, features: [] };
          groups.push(group);
        }
        group.features.push(annotation);
        for (const key of keys) groupByIdentity.set(key, group);
      }
    }

    const ambiguousLoci = [];
    let candidates = groups
      .map(group => {
        const locusTags = group.features.map(feature => this._qualityLocusTags(feature)[0] || null);
        const sharesSingleLocusTag = locusTags.every(Boolean) && new Set(locusTags).size === 1;
        const starts = group.features.map(feature => Number(feature?.start));
        const ends = group.features.map(feature => Number(feature?.end));
        const intervalsOverlap =
          starts.every(Number.isFinite) && ends.every(Number.isFinite) && Math.max(...starts) <= Math.min(...ends);
        if (group.features.length > 1 && sharesSingleLocusTag && !intervalsOverlap) {
          ambiguousLoci.push({
            chromosome: group.chromosome,
            start: Math.min(...starts),
            end: Math.max(...ends),
            strand: null,
            featureType: null,
            featureIds: group.features.map(feature => feature.id).filter(Boolean),
            locusTag: locusTags[0],
            reason: 'The same locus tag is reused by non-overlapping feature records',
          });
          return null;
        }
        const ranked = [...group.features].sort((left, right) => {
          const typeDifference = this._qualityTypePriority(right.type) - this._qualityTypePriority(left.type);
          if (typeDifference) return typeDifference;
          return String(left.id || '').localeCompare(String(right.id || ''));
        });
        const representative = ranked[0];
        const bestPriority = this._qualityTypePriority(representative?.type);
        const equallyPreferred = ranked.filter(feature => this._qualityTypePriority(feature.type) === bestPriority);
        if (equallyPreferred.length > 1) {
          ambiguousLoci.push({
            chromosome: group.chromosome,
            start: representative?.start ?? null,
            end: representative?.end ?? null,
            strand: representative?.strand ?? null,
            featureType: representative?.type || null,
            featureIds: equallyPreferred.map(feature => feature.id).filter(Boolean),
            reason: 'Multiple equally preferred feature records share the same stable locus identity',
          });
          return null;
        }
        const assessment = this._assessAnnotationObject(representative, group.chromosome);
        return {
          ...assessment,
          coLocatedFeatureTypes: Array.from(new Set(ranked.map(feature => String(feature.type || 'unknown')))),
          suppressedFeatureIds: ranked
            .slice(1)
            .map(feature => feature.id)
            .filter(Boolean),
          selectionReason:
            ranked.length > 1
              ? `Preferred ${representative.type} over co-located ${ranked
                  .slice(1)
                  .map(feature => feature.type)
                  .join(', ')}`
              : 'Only supported gene annotation feature at this locus',
        };
      })
      .filter(Boolean)
      .filter(candidate => candidate.qualityScore <= maximumQualityScore);

    let excludedByResearchHistory = 0;
    if (researchHistoryPolicy !== 'include') {
      const workflowService = this.chatManager?.services?.annotationWorkflow;
      if (
        !workflowService ||
        typeof workflowService.getAnnotationResearchCoverageIndex !== 'function' ||
        typeof workflowService._researchTargetsOverlap !== 'function'
      ) {
        throw new Error('Annotation research history is unavailable; refusing to select repeat-research candidates');
      }
      const coverage = await workflowService.getAnnotationResearchCoverageIndex({
        researchRefreshDays,
      });
      candidates = candidates.filter(candidate => {
        const target = {
          chromosome: candidate.chromosome,
          featureId: candidate.feature.id,
          locusTag: candidate.feature.locusTag,
          proteinId: candidate.feature.proteinId,
          geneSymbol: candidate.feature.gene,
          start: candidate.feature.start,
          end: candidate.feature.end,
          strand: candidate.feature.strand,
        };
        const matching = coverage.entries.filter(entry =>
          workflowService._researchTargetsOverlap(entry.target, target)
        );
        const exclude = matching.some(entry => {
          if (researchHistoryPolicy === 'exclude-active') return entry.coverageState === 'active';
          if (researchHistoryPolicy === 'exclude-completed') {
            return entry.coverageState === 'completed' && entry.effectiveCovered;
          }
          return entry.effectiveCovered;
        });
        if (exclude) excludedByResearchHistory += 1;
        return !exclude;
      });
    }

    candidates.sort((left, right) => {
      if (sortBy === 'quality') {
        const scoreDifference = left.qualityScore - right.qualityScore;
        if (scoreDifference) return scoreDifference;
      }
      return (
        String(left.chromosome).localeCompare(String(right.chromosome)) ||
        Number(left.feature.start || 0) - Number(right.feature.start || 0) ||
        String(left.feature.locusTag || left.feature.gene || left.feature.id || '').localeCompare(
          String(right.feature.locusTag || right.feature.gene || right.feature.id || '')
        )
      );
    });
    const total = candidates.length;
    const page = limit > 0 ? candidates.slice(offset, offset + limit) : candidates.slice(offset);
    return {
      success: true,
      schema: 'codexomics.annotation-quality-candidates.v1',
      policyVersion: 'codexomics.annotation-quality-policy.v1',
      selectionPolicy: sortBy === 'quality' ? 'low-quality' : 'coordinate',
      researchHistoryPolicy,
      researchRefreshDays,
      excludedByResearchHistory,
      maximumQualityScore,
      featureTypes: requestedTypes,
      total,
      offset,
      limit,
      count: page.length,
      excludedAmbiguousLoci: ambiguousLoci.length,
      ambiguousLoci,
      candidates: page,
    };
  }

  _normalizeQualifierValues(value, options = {}) {
    if (value === undefined || value === null) return [];
    const splitSemicolon = options.splitSemicolon !== false;
    const values = Array.isArray(value) ? value : [value];
    return values
      .flatMap(item => {
        const stringValue = String(item);
        const parts = splitSemicolon ? stringValue.split(/\n|;(?=\s*[A-Za-z0-9_:-])/) : [stringValue];
        return parts.map(part => part.trim());
      })
      .filter(Boolean);
  }

  _dedupeValues(values) {
    const seen = new Set();
    const result = [];
    for (const value of values) {
      const stringValue = String(value || '').trim();
      if (!stringValue) continue;
      const key = stringValue.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(stringValue);
    }
    return result;
  }

  _mergeQualifierValue(existingValue, additions, options = {}) {
    const merged = this._dedupeValues([
      ...this._normalizeQualifierValues(existingValue, options),
      ...this._normalizeQualifierValues(additions, options),
    ]);
    if (merged.length === 0) return null;
    return merged.length === 1 ? merged[0] : merged;
  }

  _stripMarkdown(text) {
    return String(text || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[#>*_~|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _parseReportPayload(reportLike) {
    if (!reportLike) return null;
    if (typeof reportLike === 'object') return reportLike;
    if (typeof reportLike !== 'string') return null;

    const trimmed = reportLike.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  _extractReportText(reportLike) {
    if (!reportLike) return '';
    if (typeof reportLike === 'string') {
      const trimmed = reportLike.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return reportLike;
      try {
        return this._extractReportText(JSON.parse(trimmed));
      } catch {
        return reportLike;
      }
    }
    if (typeof reportLike !== 'object') return String(reportLike);
    return (
      reportLike.finalReport ||
      reportLike.result?.finalReport ||
      reportLike.report?.content ||
      reportLike.result?.report?.content ||
      reportLike.report ||
      reportLike.content ||
      reportLike.text ||
      ''
    );
  }

  _extractEvidenceReferences(reportText, sources = []) {
    const evidence = [];
    const text = String(reportText || '');
    const add = value => {
      const clean = String(value || '')
        .trim()
        .replace(/[),.;\]]+$/, '');
      if (clean) evidence.push(clean);
    };

    for (const match of text.matchAll(/\bPMID[:\s]*(\d{6,10})\b/gi)) {
      add(`PMID:${match[1]}`);
    }
    for (const match of text.matchAll(/\b(?:DOI[:\s]*)?(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/gi)) {
      add(`DOI:${match[1]}`);
    }
    for (const match of text.matchAll(/https?:\/\/[^\s<>)\]]+/gi)) {
      add(match[0]);
    }

    for (const source of Array.isArray(sources) ? sources : []) {
      if (!source) continue;
      if (typeof source === 'string') {
        add(source);
        continue;
      }
      if (source.pmid) add(`PMID:${source.pmid}`);
      if (source.doi) add(`DOI:${source.doi}`);
      if (source.url) add(source.url);
      if (source.formattedCitation) add(source.formattedCitation);
      else if (source.title && source.url) add(`${source.title} - ${source.url}`);
    }

    return this._dedupeValues(evidence).slice(0, 30);
  }

  _extractAnnotationTerms(reportText) {
    const text = String(reportText || '');
    return {
      ecNumbers: this._dedupeValues(
        Array.from(text.matchAll(/\bEC[:\s]*(\d{1,2}\.\d{1,3}\.\d{1,3}\.(?:\d{1,3}|-))\b/gi)).map(match => match[1])
      ),
      goTerms: this._dedupeValues(Array.from(text.matchAll(/\bGO:\d{7}\b/gi)).map(match => match[0].toUpperCase())),
      koTerms: this._dedupeValues(Array.from(text.matchAll(/\bK\d{5}\b/g)).map(match => match[0])),
      pathwayTerms: this._dedupeValues(
        Array.from(text.matchAll(/\b(?:KEGG|Reactome|MetaCyc|BioCyc)[:\s]+([A-Za-z0-9_.:-]+)\b/gi)).map(
          match => match[0]
        )
      ),
    };
  }

  _extractResearchSummary(reportText, maxLength = 900) {
    const text = String(reportText || '');
    const sectionMatch = text.match(
      /(?:key research findings|main findings|functional summary|function(?:al)? annotation|research overview)[\s\S]{0,2500}/i
    );
    const sourceText = sectionMatch ? sectionMatch[0] : text;
    const paragraphs = sourceText
      .split(/\n{2,}/)
      .map(part => this._stripMarkdown(part))
      .filter(part => part && !/^references?$/i.test(part) && part.length > 40);
    const summary = paragraphs[0] || this._stripMarkdown(sourceText);
    return summary.length > maxLength ? `${summary.slice(0, maxLength - 3).trim()}...` : summary;
  }

  _isPlaceholderProduct(product) {
    return (
      !product || /^(unknown|hypothetical|uncharacteri[sz]ed|putative protein|predicted protein)/i.test(String(product))
    );
  }

  _normalizeAnnotationProposal(rawProposal, reportText, sources, params = {}) {
    const proposal = rawProposal && typeof rawProposal === 'object' ? rawProposal : {};
    const proposedUpdates = proposal.updates && typeof proposal.updates === 'object' ? { ...proposal.updates } : {};
    const terms = this._extractAnnotationTerms(reportText);
    const evidence = this._dedupeValues([
      ...this._normalizeQualifierValues(proposal.evidence),
      ...this._normalizeQualifierValues(proposal.sources),
      ...this._extractEvidenceReferences(reportText, sources),
    ]);
    const summary =
      proposal.summary || proposedUpdates.function_research_summary || this._extractResearchSummary(reportText);

    return {
      identifier:
        proposal.identifier || proposal.target?.identifier || params.identifier || params.geneName || params.locusTag,
      summary,
      product: proposal.product || proposedUpdates.product || null,
      confidence: proposal.confidence ?? params.confidence ?? null,
      evidence,
      reportUrl: proposal.reportUrl || proposal.download?.reportUrl || params.reportUrl || params.download?.reportUrl,
      detailsUrl:
        proposal.detailsUrl || proposal.download?.detailsUrl || params.detailsUrl || params.download?.detailsUrl,
      updates: proposedUpdates,
      ecNumbers: this._dedupeValues([
        ...this._normalizeQualifierValues(proposal.ecNumbers),
        ...this._normalizeQualifierValues(proposedUpdates.EC_number),
        ...this._normalizeQualifierValues(proposedUpdates.ec_number),
        ...terms.ecNumbers,
      ]),
      goTerms: this._dedupeValues([
        ...this._normalizeQualifierValues(proposal.goTerms),
        ...this._normalizeQualifierValues(proposedUpdates.go_terms),
        ...this._normalizeQualifierValues(proposedUpdates.GO_terms),
        ...terms.goTerms,
      ]),
      koTerms: this._dedupeValues([
        ...this._normalizeQualifierValues(proposal.koTerms),
        ...this._normalizeQualifierValues(proposedUpdates.ko),
        ...this._normalizeQualifierValues(proposedUpdates.KO),
        ...terms.koTerms,
      ]),
      pathwayTerms: this._dedupeValues([
        ...this._normalizeQualifierValues(proposal.pathwayTerms),
        ...this._normalizeQualifierValues(proposedUpdates.pathway),
        ...terms.pathwayTerms,
      ]),
      dbXrefs: this._dedupeValues([
        ...this._normalizeQualifierValues(proposal.dbXrefs),
        ...this._normalizeQualifierValues(proposedUpdates.db_xref),
        ...evidence.filter(ref => /^(PMID|DOI):/i.test(ref)),
      ]),
    };
  }

  _buildDeepResearchUpdates(annotation, proposal, params = {}) {
    const qualifiers = annotation.qualifiers || {};
    const updates = {};
    const now = new Date().toISOString();
    const summary = this._stripMarkdown(proposal.summary || '').trim();
    const evidencePreview = proposal.evidence.slice(0, 8).join('; ');
    const noteParts = [];

    if (summary) {
      updates.function_research_summary = summary;
      noteParts.push(`Deep Gene Research (${now.slice(0, 10)}): ${summary}`);
    }
    if (evidencePreview) {
      noteParts.push(`Evidence: ${evidencePreview}`);
    }

    const proposedProduct = proposal.updates.product || proposal.product;
    if (proposedProduct && (params.overwriteProduct === true || this._isPlaceholderProduct(qualifiers.product))) {
      updates.product = proposedProduct;
    }

    if (noteParts.length > 0) {
      const mergedNote = this._mergeQualifierValue(qualifiers.note, noteParts.join(' '), { splitSemicolon: false });
      if (mergedNote) updates.note = mergedNote;
    }

    if (proposal.ecNumbers.length > 0) {
      updates.EC_number = this._mergeQualifierValue(qualifiers.EC_number || qualifiers.ec_number, proposal.ecNumbers);
    }
    if (proposal.goTerms.length > 0) {
      updates.go_terms = this._mergeQualifierValue(qualifiers.go_terms || qualifiers.GO_terms, proposal.goTerms);
    }
    if (proposal.koTerms.length > 0) {
      updates.ko = this._mergeQualifierValue(qualifiers.ko || qualifiers.KO, proposal.koTerms);
    }
    if (proposal.pathwayTerms.length > 0) {
      updates.pathway = this._mergeQualifierValue(qualifiers.pathway, proposal.pathwayTerms);
    }
    if (proposal.dbXrefs.length > 0) {
      updates.db_xref = this._mergeQualifierValue(qualifiers.db_xref, proposal.dbXrefs);
    }

    const inference = `Deep Gene Research annotation merge; evidence=${proposal.evidence.length}; confidence=${
      proposal.confidence ?? 'not_specified'
    }`;
    updates.inference = this._mergeQualifierValue(qualifiers.inference, inference);
    updates.codexomics_research_updated_at = now;
    if (proposal.confidence !== null && proposal.confidence !== undefined) {
      updates.codexomics_research_confidence = String(proposal.confidence);
    }
    if (proposal.reportUrl) updates.codexomics_research_report = proposal.reportUrl;
    if (proposal.detailsUrl) updates.codexomics_research_details = proposal.detailsUrl;
    if (proposal.evidence.length > 0) {
      updates.codexomics_research_evidence = proposal.evidence;
    }

    for (const [field, value] of Object.entries(proposal.updates || {})) {
      if (value === undefined || value === null || value === '') continue;
      if (updates[field] !== undefined) continue;
      if (field === 'product' && params.overwriteProduct !== true && !this._isPlaceholderProduct(qualifiers.product)) {
        continue;
      }
      updates[field] = Array.isArray(value) ? this._mergeQualifierValue(qualifiers[field], value) : value;
    }

    return updates;
  }

  // 2. ANNOTATION MODIFICATION
  async updateAnnotation(params) {
    if (params.approvalToken && params.changeSetId) {
      return this.applyAnnotationChangeset({
        changeSetId: params.changeSetId,
        approvalToken: params.approvalToken,
        __executionContext: params.__executionContext,
      });
    }
    let changeSet;
    try {
      changeSet = await this.createAnnotationChangeset({
        ...params,
        annotationProposal: { updates: params.updates || {}, evidence: params.evidence || [] },
        principal: params.principal || params.agent || 'mcp-agent',
        __executionContext: params.__executionContext,
      });
    } catch (error) {
      const noChanges = this._describeNoOpUpdate(error, params.identifier);
      if (!noChanges) throw error;
      return noChanges;
    }
    return {
      ...changeSet,
      message:
        'Direct annotation mutation is disabled for autonomous callers. Review and approve the returned ChangeSet before applying it.',
    };
  }

  /**
   * Report a request the annotation already satisfies as a completed no-op.
   *
   * Nothing is written when a proposal reduces to zero effective operations, so failing the
   * call made callers abandon the rest of a multi-step workflow over an update that had, in
   * substance, already been performed. Every other error still propagates.
   */
  _describeNoOpUpdate(error, identifier) {
    const noEffectiveChanges = this._getChangeSetService()?.constructor?.NO_EFFECTIVE_CHANGES;
    if (!noEffectiveChanges || error?.code !== noEffectiveChanges) return null;
    return {
      success: true,
      applied: false,
      noChanges: true,
      identifier: identifier || null,
      message: `Annotation${identifier ? ` "${identifier}"` : ''} already carries the requested values; no ChangeSet was created.`,
    };
  }

  async mergeGeneResearchReport(params = {}) {
    if (!this.app.currentAnnotations) {
      throw new Error('No annotations loaded');
    }

    const selectedGene = this.app.selectedGene?.gene;
    const identifier =
      params.identifier ||
      params.annotationId ||
      params.gene ||
      params.gene_name ||
      params.geneName ||
      params.locus_tag ||
      params.locusTag ||
      selectedGene?.qualifiers?.locus_tag ||
      selectedGene?.qualifiers?.gene;
    const chromosome = params.chromosome || params.chrom || params.chr || this.app.currentChromosome;

    if (!identifier) {
      throw new Error('merge_gene_research_report requires an annotation identifier or a selected gene');
    }

    const found = this._findAnnotation(identifier, chromosome);
    if (!found) {
      throw new Error(`Annotation "${identifier}" not found`);
    }

    const rawReport = params.report || params.researchReport || params.result || params.finalReport;
    const reportPayload = this._parseReportPayload(rawReport);
    const reportText = this._extractReportText(rawReport);
    const annotationProposal =
      params.annotationProposal ||
      params.proposal ||
      reportPayload?.annotationProposal ||
      reportPayload?.result?.annotationProposal;
    const sources =
      params.sources || params.references || reportPayload?.sources || reportPayload?.result?.sources || [];
    const proposal = this._normalizeAnnotationProposal(annotationProposal, reportText, sources, {
      ...params,
      identifier,
    });
    const proposedUpdates = this._buildDeepResearchUpdates(found.annotation, proposal, params);
    const versionedProposal =
      annotationProposal?.schema === 'codexomics.annotation-change-set.v2' ? annotationProposal : null;
    const changeSetResult = await this.createAnnotationChangeset({
      identifier,
      chromosome: found.chromosome,
      baseRevision: params.baseRevision,
      annotationProposal: versionedProposal || {
        updates: proposedUpdates,
        evidence: proposal.evidence,
        confidence: proposal.confidence,
        reportUrl: proposal.reportUrl,
        detailsUrl: proposal.detailsUrl,
      },
      evidence: proposal.evidence,
      manifestHash: params.manifestHash,
      researchRun: params.researchRun || params.researchRunId,
      idempotencyKey: params.idempotencyKey,
      principal: params.principal || params.agent || 'deep-gene-research',
      __executionContext: params.__executionContext,
    });
    return {
      ...changeSetResult,
      annotationId: identifier,
      chromosome: found.chromosome,
      proposedUpdates,
      evidence: proposal.evidence,
      confidence: proposal.confidence,
      reportUrl: proposal.reportUrl,
      detailsUrl: proposal.detailsUrl,
      message: `Prepared a reviewable Deep Gene Research ChangeSet for "${identifier}". It has not been applied.`,
    };
  }

  async bulkUpdateAnnotations(params) {
    const updatesList = Array.isArray(params.updates) ? params.updates : [];
    if (updatesList.length === 0) throw new Error('bulk_update_annotations requires a non-empty updates list');
    const results = [];
    const errors = [];
    const unchanged = [];
    for (const item of updatesList) {
      try {
        const itemParams = item && typeof item === 'object' ? { ...item } : {};
        delete itemParams.__executionContext;
        results.push(
          await this.createAnnotationChangeset({
            ...itemParams,
            annotationProposal: { updates: itemParams.updates || {}, evidence: params.evidence || [] },
            principal: params.principal || params.agent || 'mcp-agent',
            __executionContext: params.__executionContext,
          })
        );
      } catch (error) {
        const noChanges = this._describeNoOpUpdate(error, item?.identifier);
        if (noChanges) {
          unchanged.push(noChanges);
          continue;
        }
        errors.push({ identifier: item?.identifier, error: error.message });
      }
    }

    // The per-item errors used to be reachable only by inspecting the result object, so a
    // caller reading just the message saw the success wording on a run that changed nothing.
    const failureDetail = errors.map(entry => `${entry.identifier || 'unknown annotation'}: ${entry.error}`).join('; ');
    const summary = [
      `${results.length} of ${updatesList.length} requested annotation update(s) became reviewable ChangeSets`,
      unchanged.length > 0 ? `${unchanged.length} already carried the requested values` : null,
      errors.length > 0 ? `${errors.length} failed (${failureDetail})` : null,
    ]
      .filter(Boolean)
      .join('; ');

    return {
      success: errors.length === 0,
      applied: false,
      totalRequested: updatesList.length,
      changeSets: results,
      unchanged,
      errors,
      message: `${summary}. No bulk annotation changes were applied; review and approve each ChangeSet to commit it.`,
    };
  }

  async getAnnotationHistory(params) {
    const { identifier, limit = 50 } = params;
    const tracker = this._getChangeTracker();

    if (identifier) {
      const history = tracker.getHistory(identifier, limit);
      return {
        success: true,
        identifier,
        total: history.length,
        changes: history,
      };
    }

    const allChanges = tracker.getAllChanges({ limit });
    const summary = tracker.getSummary();
    return {
      success: true,
      total: allChanges.length,
      summary,
      changes: allChanges,
    };
  }

  // 3. ANNOTATION CRUD
  _requireStructuralAnnotationPermission(params) {
    const context = params?.__executionContext;
    const permissions = Array.isArray(context?.permissions) ? context.permissions : [];
    if (
      context?.authenticated !== true ||
      (context.isAdmin !== true && !permissions.includes('*') && !permissions.includes('annotation:structural'))
    ) {
      throw new Error(
        'Raw structural annotation editing requires authenticated MCP permission "annotation:structural"; caller-provided approval flags are not accepted.'
      );
    }
    return context;
  }

  async editAnnotation(params) {
    const authorization = this._requireStructuralAnnotationPermission(params);
    const { annotationId, updates } = params;

    if (!this.app.currentAnnotations) {
      throw new Error('No annotations loaded');
    }

    let annotationFound = false;
    let updatedAnnotation = null;

    // Find and update annotation across all chromosomes
    Object.keys(this.app.currentAnnotations).forEach(chr => {
      const annotations = this.app.currentAnnotations[chr];
      const annotationIndex = annotations.findIndex(
        a => a.id === annotationId || a.qualifiers?.locus_tag === annotationId || a.qualifiers?.gene === annotationId
      );

      if (annotationIndex !== -1) {
        annotationFound = true;
        const annotation = annotations[annotationIndex];

        // Capture old values for change tracking
        const oldValues = {};
        Object.keys(updates).forEach(key => {
          if (key === 'qualifiers') {
            oldValues[key] = { ...annotation.qualifiers };
          } else {
            oldValues[key] = annotation[key];
          }
        });

        // Apply updates
        Object.keys(updates).forEach(key => {
          if (key === 'qualifiers') {
            annotation.qualifiers = { ...annotation.qualifiers, ...updates.qualifiers };
          } else {
            annotation[key] = updates[key];
          }
        });

        // Track changes
        const tracker = this._getChangeTracker();
        tracker.recordMultiFieldUpdate(
          annotationId,
          chr,
          updates,
          oldValues,
          authorization.principal || 'authenticated-curator',
          'mcp'
        );

        updatedAnnotation = annotation;
        annotations[annotationIndex] = annotation;
      }
    });

    if (!annotationFound) {
      throw new Error(`Annotation "${annotationId}" not found`);
    }

    return {
      success: true,
      annotationId: annotationId,
      updatedAnnotation: updatedAnnotation,
      message: `Updated annotation "${annotationId}"`,
    };
  }

  async deleteAnnotation(params) {
    const authorization = this._requireStructuralAnnotationPermission(params);
    // Support both 'annotationId' (ChatBox) and 'identifier' (MCP) parameter names
    const annotationId = params.annotationId || params.identifier;
    const agent = authorization.principal || 'authenticated-curator';

    if (!this.app.currentAnnotations) {
      throw new Error('No annotations loaded');
    }

    let annotationFound = false;
    let deletedAnnotation = null;

    // Find and delete annotation across all chromosomes
    Object.keys(this.app.currentAnnotations).forEach(chr => {
      const annotations = this.app.currentAnnotations[chr];
      const annotationIndex = annotations.findIndex(
        a =>
          a.id === annotationId ||
          a.qualifiers?.locus_tag === annotationId ||
          a.qualifiers?.gene === annotationId ||
          a.qualifiers?.protein_id === annotationId
      );

      if (annotationIndex !== -1) {
        annotationFound = true;
        deletedAnnotation = annotations[annotationIndex];

        // Track the deletion
        const tracker = this._getChangeTracker();
        tracker.recordChange({
          action: 'delete',
          annotationId,
          chromosome: chr,
          oldValue: { ...deletedAnnotation },
          agent,
          source: agent === 'mcp-agent' ? 'mcp' : 'chatbox',
        });

        annotations.splice(annotationIndex, 1);
      }
    });

    if (!annotationFound) {
      throw new Error(`Annotation "${annotationId}" not found`);
    }

    return {
      success: true,
      annotationId: annotationId,
      deletedAnnotation: deletedAnnotation,
      message: `Deleted annotation "${annotationId}"`,
    };
  }

  async batchCreateAnnotations(params) {
    this._requireStructuralAnnotationPermission(params);
    const { annotations, chromosome } = params;

    const chr = chromosome || this.app.currentChromosome;
    if (!chr) {
      throw new Error('No chromosome specified');
    }

    if (!this.app.currentAnnotations) {
      this.app.currentAnnotations = {};
    }

    if (!this.app.currentAnnotations[chr]) {
      this.app.currentAnnotations[chr] = [];
    }

    const createdAnnotations = [];

    annotations.forEach(annotationData => {
      const annotation = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        type: annotationData.type || 'feature',
        start: annotationData.start,
        end: annotationData.end,
        strand: annotationData.strand || 1,
        qualifiers: annotationData.qualifiers || {},
        created: new Date().toISOString(),
      };

      this.app.currentAnnotations[chr].push(annotation);
      createdAnnotations.push(annotation);
    });

    return {
      success: true,
      chromosome: chr,
      annotationsCreated: createdAnnotations.length,
      annotations: createdAnnotations,
    };
  }
}

// Make it available globally if needed by plugin system
window.AnnotationService = AnnotationService;
