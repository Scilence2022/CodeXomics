// @ts-check
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

  async createAnnotationChangeset(params) {
    return this._getChangeSetService().createAnnotationChangeset(params);
  }

  async getAnnotationChangeset(params) {
    return this._getChangeSetService().getAnnotationChangeset(params);
  }

  async requestAnnotationApproval(params) {
    return this._getChangeSetService().requestAnnotationApproval(params);
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
        const geneName = Array.isArray(qualifiers.gene) ? qualifiers.gene[0] : qualifiers.gene || '';
        const locusTag = Array.isArray(qualifiers.locus_tag) ? qualifiers.locus_tag[0] : qualifiers.locus_tag || '';
        const proteinId = Array.isArray(qualifiers.protein_id) ? qualifiers.protein_id[0] : qualifiers.protein_id || '';

        if (
          targetIdentifier === annotation.id ||
          targetIdentifier === geneName ||
          targetIdentifier === locusTag ||
          targetIdentifier === proteinId
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
    const changeSet = await this.createAnnotationChangeset({
      ...params,
      annotationProposal: { updates: params.updates || {}, evidence: params.evidence || [] },
      principal: params.principal || params.agent || 'mcp-agent',
    });
    if (params.approvalToken && params.changeSetId) {
      return this.applyAnnotationChangeset({ changeSetId: params.changeSetId, approvalToken: params.approvalToken });
    }
    return {
      ...changeSet,
      message:
        'Direct annotation mutation is disabled for autonomous callers. Review and approve the returned ChangeSet before applying it.',
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
    const changeSetResult = await this.createAnnotationChangeset({
      identifier,
      chromosome: found.chromosome,
      baseRevision: params.baseRevision,
      annotationProposal: {
        schema: 'codexomics.annotation-change-set.v2',
        target: params.annotationProposal?.target || params.proposal?.target,
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
    for (const item of updatesList) {
      try {
        results.push(
          await this.createAnnotationChangeset({
            ...item,
            annotationProposal: { updates: item.updates || {}, evidence: params.evidence || [] },
            principal: params.principal || params.agent || 'mcp-agent',
          })
        );
      } catch (error) {
        errors.push({ identifier: item.identifier, error: error.message });
      }
    }
    return {
      success: errors.length === 0,
      applied: false,
      totalRequested: updatesList.length,
      changeSets: results,
      errors,
      message: 'Created independent reviewable ChangeSets; no bulk annotation changes were applied.',
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
    if (params.manualCuratorApproval !== true) {
      throw new Error(
        'Raw annotation editing is not available through the autonomous annotation API. Create a constrained ChangeSet instead.'
      );
    }
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
    if (params.manualCuratorApproval !== true) {
      throw new Error(
        'Feature deletion is a structural genome operation and is not available through the autonomous annotation API. Use the manual genome editor and export a reviewed revision.'
      );
    }
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
    if (params.manualCuratorApproval !== true) {
      throw new Error(
        'Feature creation is a structural genome operation and is not available through the autonomous annotation API. Use the manual genome editor and export a reviewed revision.'
      );
    }
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
