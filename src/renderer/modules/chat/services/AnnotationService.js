// @ts-check
/**
 * AnnotationService - Handles annotation-related operations extracted from ChatManager
 */
class AnnotationService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  // Helper method extracted from ChatManager
  _getChangeTracker() {
    return this.chatManager._getChangeTracker();
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
    const chromosomes = chromosome ? [chromosome] : Object.keys(this.app.currentAnnotations);

    for (const chr of chromosomes) {
      const annotations = this.app.currentAnnotations[chr];
      if (!annotations) {
        continue;
      }

      for (const annotation of annotations) {
        const qualifiers = annotation.qualifiers || {};
        const geneName = Array.isArray(qualifiers.gene) ? qualifiers.gene[0] : qualifiers.gene || '';
        const locusTag = Array.isArray(qualifiers.locus_tag) ? qualifiers.locus_tag[0] : qualifiers.locus_tag || '';
        const proteinId = Array.isArray(qualifiers.protein_id) ? qualifiers.protein_id[0] : qualifiers.protein_id || '';

        if (
          identifier === annotation.id ||
          identifier === geneName ||
          identifier === locusTag ||
          identifier === proteinId
        ) {
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

  // 2. ANNOTATION MODIFICATION
  async updateAnnotation(params) {
    const identifier =
      params.identifier ||
      params.annotationId ||
      params.gene ||
      params.gene_name ||
      params.geneName ||
      params.locus_tag ||
      params.locusTag;
    const { chromosome, updates, agent = 'mcp-agent', evidence = [] } = params;

    if (!this.app.currentAnnotations) {
      throw new Error('No annotations loaded');
    }

    const found = this._findAnnotation(identifier, chromosome);
    if (!found) {
      throw new Error(`Annotation "${identifier}" not found`);
    }

    // Get the locus_tag and gene name from the found annotation to match other features
    const targetLocusTag = Array.isArray(found.annotation.qualifiers?.locus_tag)
      ? found.annotation.qualifiers.locus_tag[0]
      : found.annotation.qualifiers?.locus_tag || '';
    const targetGeneName = Array.isArray(found.annotation.qualifiers?.gene)
      ? found.annotation.qualifiers.gene[0]
      : found.annotation.qualifiers?.gene || '';

    // Find all annotations with the same locus_tag or gene name
    const annotationsToUpdate = [];
    const chromosomesToCheck = chromosome ? [chromosome] : Object.keys(this.app.currentAnnotations);

    for (const chr of chromosomesToCheck) {
      const annotations = this.app.currentAnnotations[chr];
      if (!annotations) continue;

      for (const annotation of annotations) {
        const qualifiers = annotation.qualifiers || {};
        const geneName = Array.isArray(qualifiers.gene) ? qualifiers.gene[0] : qualifiers.gene || '';
        const locusTag = Array.isArray(qualifiers.locus_tag) ? qualifiers.locus_tag[0] : qualifiers.locus_tag || '';

        // Match by locus_tag or gene name
        if ((targetLocusTag && locusTag === targetLocusTag) || (targetGeneName && geneName === targetGeneName)) {
          annotationsToUpdate.push({ chromosome: chr, annotation });
        }
      }
    }

    // Update all matching annotations
    for (const { annotation } of annotationsToUpdate) {
      const oldValues = {};

      // Capture old values and apply updates
      for (const [field, newValue] of Object.entries(updates)) {
        if (field === 'start' || field === 'end' || field === 'strand' || field === 'type') {
          // Top-level fields
          oldValues[field] = annotation[field];
          annotation[field] = newValue;
        } else {
          // Qualifier fields
          if (!annotation.qualifiers) annotation.qualifiers = {};
          oldValues[field] = annotation.qualifiers[field] || null;
          annotation.qualifiers[field] = newValue;
        }
      }

      // Record changes for each annotation
      const tracker = this._getChangeTracker();
      tracker.recordMultiFieldUpdate(identifier, found.chromosome, updates, oldValues, agent, 'mcp', evidence);
    }

    return {
      success: true,
      annotationId: identifier,
      chromosome: found.chromosome,
      updatedFields: Object.keys(updates),
      updatedAnnotation: {
        id: found.annotation.id,
        type: found.annotation.type,
        start: found.annotation.start,
        end: found.annotation.end,
        strand: found.annotation.strand,
        qualifiers: found.annotation.qualifiers,
      },
      message: `Updated ${Object.keys(updates).length} field(s) on ${annotationsToUpdate.length} annotation(s) for "${identifier}"`,
    };
  }

  async bulkUpdateAnnotations(params) {
    const { updates: updatesList, agent = 'mcp-agent', evidence = [] } = params;

    if (!this.app.currentAnnotations) {
      throw new Error('No annotations loaded');
    }

    const results = [];
    const errors = [];

    for (const item of updatesList) {
      try {
        const result = await this.updateAnnotation({
          identifier: item.identifier,
          chromosome: item.chromosome,
          updates: item.updates,
          agent,
          evidence,
        });
        results.push({ identifier: item.identifier, success: true });
      } catch (error) {
        errors.push({ identifier: item.identifier, error: error.message });
      }
    }

    return {
      success: errors.length === 0,
      totalRequested: updatesList.length,
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors,
      message: `Updated ${results.length}/${updatesList.length} annotations`,
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
  async editAnnotation(params) {
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
        tracker.recordMultiFieldUpdate(annotationId, chr, updates, oldValues, 'chatbox', 'chatbox');

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
    // Support both 'annotationId' (ChatBox) and 'identifier' (MCP) parameter names
    const annotationId = params.annotationId || params.identifier;
    const agent = params.agent || 'chatbox';

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
