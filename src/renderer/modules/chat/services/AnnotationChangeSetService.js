// @ts-check
/**
 * AnnotationChangeSetService
 *
 * The only autonomous-annotation write path.  Research agents create an
 * immutable, reviewable change set; a separately issued approval capability
 * is required before it can be committed against the expected revision.
 *
 * The ledger is deliberately stored per genome sidecar rather than in the
 * global browser localStorage used by the legacy change tracker.  This gives
 * a loaded genome an independent revision, audit trail, and restart-safe
 * pending review queue without modifying the source genome file.
 */
class AnnotationChangeSetService {
  constructor(app, chatManager, annotationService) {
    this.app = app;
    this.chatManager = chatManager;
    this.annotationService = annotationService;
    this.memoryLedgers = new Map();
    this.allowedQualifierFields = new Set([
      'product',
      'note',
      'db_xref',
      'EC_number',
      'go_terms',
      'ko',
      'pathway',
      'inference',
      'codexomics_research_evidence',
      'codexomics_research_report',
      'codexomics_research_details',
      'codexomics_research_confidence',
      'codexomics_research_updated_at',
      'function_research_summary',
    ]);
    this.allowedOperations = new Set([
      'addQualifier',
      'replaceQualifier',
      'removeQualifier',
      'addDbxref',
      'addEvidenceLink',
    ]);
  }

  _genomePath() {
    return (
      this.app?.currentFile?.path ||
      this.app?.fileManager?.currentFile?.path ||
      this.app?.fileManager?.currentFile?.info?.path ||
      null
    );
  }

  _ledgerKey() {
    return this._genomePath() || this.app?.currentGenomeName || this.app?.currentChromosome || 'unsaved-genome';
  }

  _newLedger() {
    return {
      schema: 'codexomics.annotation-ledger.v2',
      revision: 0,
      changeSets: {},
      approvals: {},
      audit: [],
      committedIdempotencyKeys: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  _normaliseLedger(value) {
    const base = this._newLedger();
    const ledger = value && typeof value === 'object' ? { ...base, ...value } : base;
    ledger.changeSets = ledger.changeSets && typeof ledger.changeSets === 'object' ? ledger.changeSets : {};
    ledger.approvals = ledger.approvals && typeof ledger.approvals === 'object' ? ledger.approvals : {};
    ledger.audit = Array.isArray(ledger.audit) ? ledger.audit : [];
    ledger.committedIdempotencyKeys =
      ledger.committedIdempotencyKeys && typeof ledger.committedIdempotencyKeys === 'object'
        ? ledger.committedIdempotencyKeys
        : {};
    ledger.revision = Number.isInteger(ledger.revision) && ledger.revision >= 0 ? ledger.revision : 0;
    return ledger;
  }

  async _loadLedger() {
    const genomePath = this._genomePath();
    const sidecar = this.app?.sidecarManager;
    if (genomePath && sidecar && typeof sidecar.get === 'function') {
      const ledger = this._normaliseLedger(await sidecar.get(genomePath, 'annotationCuration'));
      this.memoryLedgers.set(this._ledgerKey(), ledger);
      return ledger;
    }
    const key = this._ledgerKey();
    if (!this.memoryLedgers.has(key)) this.memoryLedgers.set(key, this._newLedger());
    return this.memoryLedgers.get(key);
  }

  async _saveLedger(ledger) {
    ledger.updatedAt = new Date().toISOString();
    const genomePath = this._genomePath();
    const sidecar = this.app?.sidecarManager;
    this.memoryLedgers.set(this._ledgerKey(), ledger);
    if (genomePath && sidecar && typeof sidecar.set === 'function') {
      await sidecar.set(genomePath, 'annotationCuration', ledger);
      if (typeof sidecar.forceSave === 'function') await sidecar.forceSave(genomePath);
    }
  }

  async _hash(value) {
    const input = JSON.stringify(value);
    if (globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(input);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    }
    // Fallback is for older Electron renderers only; it is never used as an
    // authentication secret.
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a-${(hash >>> 0).toString(16)}`;
  }

  _id(prefix) {
    const random = globalThis.crypto?.getRandomValues
      ? Array.from(globalThis.crypto.getRandomValues(new Uint32Array(2)))
          .map(value => value.toString(36))
          .join('')
      : Math.random().toString(36).slice(2);
    return `${prefix}_${Date.now().toString(36)}_${random}`;
  }

  _scalar(value) {
    return Array.isArray(value) ? value[0] || '' : value || '';
  }

  async _featureRef(chromosome, annotation, ledger) {
    const qualifiers = annotation.qualifiers || {};
    const locusTag = this._scalar(qualifiers.locus_tag);
    const geneSymbol = this._scalar(qualifiers.gene);
    const proteinId = this._scalar(qualifiers.protein_id);
    const stableInput = {
      chromosome,
      id: annotation.id || null,
      locusTag,
      proteinId,
      start: annotation.start,
      end: annotation.end,
      strand: annotation.strand,
      type: annotation.type,
    };
    const featureId = annotation.codexomicsFeatureId || `feat_${await this._hash(stableInput)}`;
    const featureHash = await this._hash({
      ...stableInput,
      qualifiers: annotation.qualifiers || {},
    });
    const genomePath = this._genomePath();
    const workspaceId = `ws_${await this._hash(genomePath || this.app?.currentGenomeName || 'unsaved')}`;
    return {
      workspaceId,
      genomeId: `genome_${await this._hash(genomePath || this.app?.currentGenomeName || 'unsaved')}`,
      annotationRevision: ledger.revision,
      featureId,
      featureHash,
      chromosome,
      locusTag: locusTag || null,
      geneSymbol: geneSymbol || null,
      proteinId: proteinId || null,
      coordinates: {
        start: annotation.start,
        end: annotation.end,
        strand: annotation.strand,
      },
      featureType: annotation.type || null,
    };
  }

  _findFeatureById(featureId) {
    if (!this.app?.currentAnnotations) return null;
    for (const [chromosome, annotations] of Object.entries(this.app.currentAnnotations)) {
      for (const annotation of annotations || []) {
        // Stable IDs are derived identically in _featureRef.  The comparison
        // below is resolved asynchronously by _findFeatureByRef instead.
        if (annotation.codexomicsFeatureId === featureId) return { chromosome, annotation };
      }
    }
    return null;
  }

  async _findFeatureByRef(target) {
    if (!this.app?.currentAnnotations) return null;
    const candidates = target.chromosome
      ? [[target.chromosome, this.app.currentAnnotations[target.chromosome] || []]]
      : Object.entries(this.app.currentAnnotations);
    for (const [chromosome, annotations] of candidates) {
      for (const annotation of annotations || []) {
        const ref = await this._featureRef(chromosome, annotation, { revision: target.annotationRevision || 0 });
        if (ref.featureId === target.featureId) return { chromosome, annotation, ref };
      }
    }
    return this._findFeatureById(target.featureId);
  }

  _normaliseValues(value) {
    const values = Array.isArray(value) ? value : [value];
    return values
      .filter(item => item !== undefined && item !== null)
      .map(item => String(item).trim())
      .filter(Boolean);
  }

  _isPlaceholderProduct(product) {
    return (
      !product || /^(unknown|hypothetical|uncharacteri[sz]ed|putative protein|predicted protein)/i.test(String(product))
    );
  }

  _validateOperation(operation, annotation) {
    if (!operation || typeof operation !== 'object') throw new Error('ChangeSet operation must be an object');
    if (!this.allowedOperations.has(operation.op)) throw new Error(`Unsupported annotation operation: ${operation.op}`);

    const field =
      operation.op === 'addDbxref'
        ? 'db_xref'
        : operation.op === 'addEvidenceLink'
          ? 'codexomics_research_evidence'
          : operation.field;
    if (!field || !this.allowedQualifierFields.has(field)) {
      throw new Error(`Field "${field || 'unknown'}" is not writable by the autonomous annotation profile`);
    }
    if (['start', 'end', 'strand', 'type', 'sequence', 'translation'].includes(field)) {
      throw new Error(`Structural field "${field}" cannot be changed by an annotation research ChangeSet`);
    }
    if (operation.op !== 'removeQualifier' && this._normaliseValues(operation.value).length === 0) {
      throw new Error(`Operation ${operation.op} requires a non-empty value`);
    }
    if (operation.op === 'replaceQualifier' && field === 'product') {
      const currentProduct = this._scalar(annotation.qualifiers?.product);
      if (!this._isPlaceholderProduct(currentProduct) && operation.allowProductReplacement !== true) {
        operation.requiresHumanReview = true;
      }
    }
    if (operation.op === 'removeQualifier') operation.requiresHumanReview = true;
    return { ...operation, field };
  }

  _proposalToOperations(params, annotation) {
    if (Array.isArray(params.operations)) return params.operations;
    const proposal = params.annotationProposal || params.proposal || {};
    if (Array.isArray(proposal.operations)) return proposal.operations;
    const updates = proposal.updates || params.updates || {};
    const operations = [];
    for (const [field, value] of Object.entries(updates)) {
      if (value === undefined || value === null || value === '') continue;
      operations.push({
        op:
          field === 'db_xref'
            ? 'addDbxref'
            : field === 'codexomics_research_evidence'
              ? 'addEvidenceLink'
              : 'addQualifier',
        field,
        value,
      });
    }
    if (proposal.summary && !updates.function_research_summary) {
      operations.push({ op: 'addQualifier', field: 'function_research_summary', value: proposal.summary });
    }
    if (proposal.reportUrl)
      operations.push({ op: 'addQualifier', field: 'codexomics_research_report', value: proposal.reportUrl });
    if (proposal.detailsUrl)
      operations.push({ op: 'addQualifier', field: 'codexomics_research_details', value: proposal.detailsUrl });
    if (proposal.confidence !== undefined && proposal.confidence !== null) {
      operations.push({
        op: 'addQualifier',
        field: 'codexomics_research_confidence',
        value: String(proposal.confidence),
      });
    }
    if (Array.isArray(proposal.evidence) && proposal.evidence.length > 0) {
      operations.push({ op: 'addEvidenceLink', value: proposal.evidence });
    }
    return operations;
  }

  async resolveAnnotationTarget(params = {}) {
    const ledger = await this._loadLedger();
    const identifier = params.identifier || params.annotationId || params.gene || params.geneSymbol || params.locusTag;
    const chromosome = params.chromosome || params.chrom || params.chr || this.app?.currentChromosome;
    if (!identifier) throw new Error('resolve_annotation_target requires an identifier');
    const found = this.annotationService._findAnnotation(identifier, chromosome);
    if (!found) throw new Error(`Annotation "${identifier}" not found`);
    return {
      success: true,
      target: await this._featureRef(found.chromosome, found.annotation, ledger),
      annotation: {
        id: found.annotation.id || null,
        qualifiers: found.annotation.qualifiers || {},
      },
    };
  }

  async createAnnotationChangeset(params = {}) {
    const ledger = await this._loadLedger();
    const resolved = await this.resolveAnnotationTarget(params);
    const { target } = resolved;
    const found = await this._findFeatureByRef(target);
    if (!found) throw new Error(`Target feature ${target.featureId} is no longer available`);

    const proposalTarget = params.annotationProposal?.target || params.proposal?.target;
    if (proposalTarget?.featureId && proposalTarget.featureId !== target.featureId) {
      throw new Error('Proposal target featureId does not match the selected CodeXomics feature');
    }
    if (proposalTarget?.locusTag && target.locusTag && proposalTarget.locusTag !== target.locusTag) {
      throw new Error('Proposal locusTag does not match the selected CodeXomics feature');
    }
    if (params.baseRevision !== undefined && Number(params.baseRevision) !== ledger.revision) {
      throw new Error(
        `Stale ChangeSet request: expected revision ${params.baseRevision}, current revision is ${ledger.revision}`
      );
    }

    const rawOperations = this._proposalToOperations(params, found.annotation);
    if (rawOperations.length === 0) throw new Error('ChangeSet contains no supported annotation operations');
    const operations = rawOperations.map(operation => this._validateOperation({ ...operation }, found.annotation));
    const riskLevel = operations.some(
      operation =>
        operation.requiresHumanReview || operation.op === 'replaceQualifier' || operation.op === 'removeQualifier'
    )
      ? 'high'
      : operations.some(operation => ['product', 'EC_number', 'go_terms', 'ko', 'pathway'].includes(operation.field))
        ? 'medium'
        : 'low';
    const evidence = this._normaliseValues(
      params.evidence || params.annotationProposal?.evidence || params.proposal?.evidence || []
    );
    const idempotencyKey = params.idempotencyKey || this._id('idem');
    const existingId = ledger.committedIdempotencyKeys[idempotencyKey];
    if (existingId) return { success: true, duplicate: true, changeSet: ledger.changeSets[existingId] };

    const changeSet = {
      schema: 'codexomics.annotation-change-set.v2',
      id: this._id('cs'),
      status: 'awaiting_approval',
      createdAt: new Date().toISOString(),
      createdBy: params.principal || params.agent || 'unknown-agent',
      idempotencyKey,
      baseRevision: ledger.revision,
      target,
      evidence,
      researchRun: params.researchRun || params.researchRunId || null,
      manifestHash: params.manifestHash || null,
      operations,
      riskLevel,
      requiresHumanApproval: true,
      validation: {
        valid: true,
        checkedAt: new Date().toISOString(),
        allowedFields: Array.from(new Set(operations.map(operation => operation.field))),
      },
    };
    changeSet.changeSetHash = await this._hash({ ...changeSet, changeSetHash: undefined });
    ledger.changeSets[changeSet.id] = changeSet;
    ledger.audit.push({
      id: this._id('audit'),
      event: 'changeset_created',
      changeSetId: changeSet.id,
      principal: changeSet.createdBy,
      timestamp: new Date().toISOString(),
      target: changeSet.target,
    });
    await this._saveLedger(ledger);
    return { success: true, applied: false, changeSet, preview: this._preview(changeSet, found.annotation) };
  }

  _preview(changeSet, annotation) {
    return changeSet.operations.map(operation => ({
      op: operation.op,
      field: operation.field,
      before: annotation.qualifiers?.[operation.field] ?? null,
      after: operation.value ?? null,
      requiresHumanReview: Boolean(operation.requiresHumanReview),
    }));
  }

  async getAnnotationChangeset(params = {}) {
    const ledger = await this._loadLedger();
    const changeSet = ledger.changeSets[params.changeSetId || params.id];
    if (!changeSet) throw new Error(`ChangeSet "${params.changeSetId || params.id}" not found`);
    return { success: true, changeSet };
  }

  async requestAnnotationApproval(params = {}) {
    const ledger = await this._loadLedger();
    const changeSet = ledger.changeSets[params.changeSetId || params.id];
    if (!changeSet) throw new Error('ChangeSet not found');
    if (changeSet.status !== 'awaiting_approval')
      throw new Error(`ChangeSet is ${changeSet.status}, not awaiting approval`);
    const approver = String(params.approver || params.principal || '').trim();
    if (!approver) throw new Error('request_annotation_approval requires an approver identity');
    if (approver === changeSet.createdBy && params.allowSelfApproval !== true) {
      throw new Error('The ChangeSet creator cannot self-approve an autonomous annotation change');
    }
    const expiresAt = new Date(
      Date.now() + Math.max(1, Math.min(Number(params.expiresInMinutes) || 30, 24 * 60)) * 60000
    ).toISOString();
    const approval = {
      id: this._id('approval'),
      changeSetId: changeSet.id,
      changeSetHash: changeSet.changeSetHash,
      baseRevision: changeSet.baseRevision,
      approver,
      approvedAt: new Date().toISOString(),
      expiresAt,
      token: this._id('cap'),
    };
    ledger.approvals[approval.id] = approval;
    changeSet.status = 'approved';
    changeSet.approvalId = approval.id;
    ledger.audit.push({
      id: this._id('audit'),
      event: 'changeset_approved',
      changeSetId: changeSet.id,
      principal: approver,
      timestamp: approval.approvedAt,
    });
    await this._saveLedger(ledger);
    return { success: true, approval: { ...approval }, approvalToken: approval.token };
  }

  _applyOperation(annotation, operation) {
    if (!annotation.qualifiers) annotation.qualifiers = {};
    const field = operation.field;
    const oldValue = annotation.qualifiers[field];
    if (operation.op === 'removeQualifier') {
      delete annotation.qualifiers[field];
    } else if (operation.op === 'replaceQualifier') {
      annotation.qualifiers[field] = Array.isArray(operation.value) ? [...operation.value] : operation.value;
    } else {
      const existing = this._normaliseValues(annotation.qualifiers[field]);
      const incoming = this._normaliseValues(operation.value);
      const merged = [];
      const seen = new Set();
      for (const value of [...existing, ...incoming]) {
        const key = value.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(value);
        }
      }
      annotation.qualifiers[field] = merged.length === 1 ? merged[0] : merged;
    }
    return oldValue;
  }

  async applyAnnotationChangeset(params = {}) {
    const ledger = await this._loadLedger();
    const changeSet = ledger.changeSets[params.changeSetId || params.id];
    if (!changeSet) throw new Error('ChangeSet not found');
    if (ledger.committedIdempotencyKeys[changeSet.idempotencyKey]) {
      return { success: true, duplicate: true, receipt: ledger.committedIdempotencyKeys[changeSet.idempotencyKey] };
    }
    if (changeSet.status !== 'approved')
      throw new Error(`ChangeSet is ${changeSet.status}; approval is required before commit`);
    const approval = ledger.approvals[changeSet.approvalId];
    if (!approval || approval.token !== params.approvalToken || new Date(approval.expiresAt).getTime() < Date.now()) {
      throw new Error('A valid, unexpired approval capability is required before commit');
    }
    if (changeSet.baseRevision !== ledger.revision) {
      changeSet.status = 'stale';
      await this._saveLedger(ledger);
      throw new Error(
        `ChangeSet is stale: base revision ${changeSet.baseRevision}, current revision ${ledger.revision}`
      );
    }
    const found = await this._findFeatureByRef(changeSet.target);
    if (!found) throw new Error('ChangeSet target feature is no longer available');
    if (found.ref.featureHash !== changeSet.target.featureHash) {
      changeSet.status = 'stale';
      await this._saveLedger(ledger);
      throw new Error(
        'ChangeSet target has changed since preview; create a new proposal against the current feature revision'
      );
    }

    const workingCopy = JSON.parse(JSON.stringify(found.annotation));
    const appliedOperations = [];
    for (const operation of changeSet.operations) {
      const oldValue = this._applyOperation(workingCopy, operation);
      appliedOperations.push({ ...operation, oldValue });
    }
    // Atomic renderer-side swap: no live annotation changes until every
    // operation has been validated and applied to the detached working copy.
    Object.keys(found.annotation).forEach(key => delete found.annotation[key]);
    Object.assign(found.annotation, workingCopy);

    ledger.revision += 1;
    const receipt = {
      id: this._id('commit'),
      changeSetId: changeSet.id,
      committedAt: new Date().toISOString(),
      principal: approval.approver,
      previousRevision: changeSet.baseRevision,
      revision: ledger.revision,
      target: changeSet.target,
      appliedOperations,
      evidence: changeSet.evidence,
      manifestHash: changeSet.manifestHash,
    };
    receipt.receiptHash = await this._hash(receipt);
    changeSet.status = 'committed';
    changeSet.commitReceipt = receipt;
    ledger.committedIdempotencyKeys[changeSet.idempotencyKey] = receipt;
    ledger.audit.push({
      id: this._id('audit'),
      event: 'changeset_committed',
      changeSetId: changeSet.id,
      principal: approval.approver,
      timestamp: receipt.committedAt,
      receiptId: receipt.id,
    });

    const tracker = this.annotationService._getChangeTracker();
    for (const operation of appliedOperations) {
      tracker.recordChange({
        action: 'update',
        annotationId: changeSet.target.featureId,
        chromosome: found.chromosome,
        field: operation.field,
        oldValue: operation.oldValue ?? null,
        newValue: found.annotation.qualifiers?.[operation.field] ?? null,
        agent: approval.approver,
        source: 'changeset',
        evidence: changeSet.evidence,
        metadata: { changeSetId: changeSet.id, receiptId: receipt.id },
      });
    }
    await this._saveLedger(ledger);
    if (this.app?.selectedGene?.gene === found.annotation && typeof this.app.populateGeneDetails === 'function') {
      this.app.populateGeneDetails(found.annotation, this.app.selectedGene.operonInfo);
    }
    return { success: true, applied: true, receipt, annotation: found.annotation };
  }

  async rollbackAnnotationChangeset(params = {}) {
    const ledger = await this._loadLedger();
    const original = ledger.changeSets[params.changeSetId || params.id];
    if (!original?.commitReceipt) throw new Error('Only a committed ChangeSet can be rolled back');
    const target = original.target;
    const operations = original.commitReceipt.appliedOperations.map(operation => ({
      op: operation.oldValue === undefined || operation.oldValue === null ? 'removeQualifier' : 'replaceQualifier',
      field: operation.field,
      value: operation.oldValue,
      requiresHumanReview: true,
    }));
    return this.createAnnotationChangeset({
      identifier: target.locusTag || target.geneSymbol || target.proteinId,
      chromosome: target.chromosome,
      baseRevision: ledger.revision,
      operations,
      evidence: [`rollback:${original.commitReceipt.id}`],
      principal: params.principal || params.agent || 'rollback-service',
      researchRun: `rollback:${original.id}`,
    });
  }

  async getAnnotationAudit(params = {}) {
    const ledger = await this._loadLedger();
    const limit = Math.max(1, Math.min(Number(params.limit) || 100, 1000));
    return { success: true, revision: ledger.revision, audit: ledger.audit.slice(-limit).reverse() };
  }
}

if (typeof window !== 'undefined') {
  window.AnnotationChangeSetService = AnnotationChangeSetService;
}
