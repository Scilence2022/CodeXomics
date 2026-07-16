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
    this.ledgerLocks = new Map();
    this.integrityVersion = 2;
    this.hashVersions = Object.freeze({
      current: 'canonical-json-v1',
      legacy: 'raw-json-v1',
    });
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
    this.scientificQualifierFields = new Set(['product', 'EC_number', 'go_terms', 'ko', 'pathway', 'db_xref']);
    this.inputLimits = Object.freeze({
      serializedBytes: 1024 * 1024,
      operations: 100,
      claims: 200,
      evidenceRecords: 200,
      evidenceReferences: 200,
      valuesPerField: 100,
      referencesPerOperation: 100,
      identifierLength: 256,
      textLength: 8192,
      referenceLength: 2048,
    });
    this.ledgerLimits = Object.freeze({
      changeSets: 10000,
      approvals: 20000,
      auditEvents: 100000,
      idempotencyKeys: 10000,
      committedIdempotencyKeys: 10000,
      pendingChangeSetsPerPrincipal: 200,
    });
  }

  _genomePath() {
    return (
      this.app?.loadedGenomePath ||
      this.app?.fileManager?.genomeBrowser?.loadedGenomePath ||
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
      integrityVersion: this.integrityVersion,
      revision: 0,
      changeSets: Object.create(null),
      approvals: Object.create(null),
      audit: [],
      idempotencyKeys: Object.create(null),
      committedIdempotencyKeys: Object.create(null),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  _normaliseLedger(value) {
    const base = this._newLedger();
    if (value === undefined || value === null) return base;
    if (!this._isPlainRecord(value)) throw new Error('Annotation ledger must be a JSON object');
    if (Object.keys(value).length === 0) return base;
    if (value.schema !== 'codexomics.annotation-ledger.v2') {
      throw new Error(`Unsupported or missing annotation ledger schema: ${value.schema || 'missing'}`);
    }
    const isLegacyV2 = value.integrityVersion === undefined;
    if (!isLegacyV2 && value.integrityVersion !== this.integrityVersion) {
      throw new Error(`Unsupported annotation ledger integrity version: ${value.integrityVersion}`);
    }
    for (const field of ['changeSets', 'approvals', 'committedIdempotencyKeys']) {
      if (!this._isPlainRecord(value[field])) {
        throw new Error(`Annotation ledger field "${field}" must be a JSON object`);
      }
    }
    if ((!isLegacyV2 || value.idempotencyKeys !== undefined) && !this._isPlainRecord(value.idempotencyKeys)) {
      throw new Error('Annotation ledger field "idempotencyKeys" must be a JSON object');
    }
    if (!Array.isArray(value.audit)) throw new Error('Annotation ledger field "audit" must be an array');
    if (!Number.isInteger(value.revision) || value.revision < 0) {
      throw new Error('Annotation ledger revision must be a non-negative integer');
    }
    const ledger = { ...base, ...value };
    if (isLegacyV2) delete ledger.integrityVersion;
    for (const field of ['changeSets', 'approvals', 'committedIdempotencyKeys']) {
      ledger[field] = this._createLedgerMap(value[field]);
    }
    ledger.idempotencyKeys = this._createLedgerMap(value.idempotencyKeys || {});
    if (!isLegacyV2) {
      for (const changeSet of Object.values(ledger.changeSets)) {
        if (!changeSet?.idempotencyKey) continue;
        let record = this._ledgerMapGet(ledger.idempotencyKeys, changeSet.idempotencyKey);
        if (!record) {
          record = this._ledgerMapSet(ledger.idempotencyKeys, changeSet.idempotencyKey, {
            changeSetId: changeSet.id,
            requestHash: changeSet.requestHash || null,
            ...(changeSet.legacyIntegrity && !changeSet.requestHash ? { legacyOpaque: true } : {}),
          });
        }
        if (
          changeSet.legacyIntegrity &&
          !changeSet.requestHash &&
          (typeof record === 'string' || record.legacyOpaque !== true)
        ) {
          throw new Error(`Migrated legacy idempotency key "${changeSet.idempotencyKey}" lost its opaque binding`);
        }
      }
    }
    this._assertLedgerCapacity(ledger);
    return ledger;
  }

  _assertLedgerCapacity(ledger) {
    const collections = [
      ['changeSets', Object.keys(ledger.changeSets || {}).length, this.ledgerLimits.changeSets],
      ['approvals', Object.keys(ledger.approvals || {}).length, this.ledgerLimits.approvals],
      ['audit events', Array.isArray(ledger.audit) ? ledger.audit.length : 0, this.ledgerLimits.auditEvents],
      ['idempotency keys', Object.keys(ledger.idempotencyKeys || {}).length, this.ledgerLimits.idempotencyKeys],
      [
        'committed idempotency keys',
        Object.keys(ledger.committedIdempotencyKeys || {}).length,
        this.ledgerLimits.committedIdempotencyKeys,
      ],
    ];
    for (const [label, count, limit] of collections) {
      if (count > limit) {
        throw new Error(
          `Annotation ledger exceeds the ${limit} ${label} retention limit; archive and reconcile this genome's curation ledger before continuing`
        );
      }
    }
  }

  _isPlainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  _isValidPmid(value) {
    return /^[1-9]\d{0,9}$/.test(String(value || '').trim());
  }

  _annotationMatchesTarget(annotation, target) {
    if (!annotation || !target) return false;
    if (annotation.codexomicsFeatureId && annotation.codexomicsFeatureId === target.featureId) return true;
    const qualifiers = annotation.qualifiers || {};
    const stableMatches = [
      [this._scalar(qualifiers.locus_tag), target.locusTag],
      [this._scalar(qualifiers.protein_id), target.proteinId],
      [this._scalar(qualifiers.gene), target.geneSymbol],
    ].some(([current, expected]) => current && expected && String(current) === String(expected));
    if (!stableMatches) return false;
    const coordinates = target.coordinates || {};
    return (
      Number(annotation.start) === Number(coordinates.start) &&
      Number(annotation.end) === Number(coordinates.end) &&
      Number(annotation.strand) === Number(coordinates.strand)
    );
  }

  _createLedgerMap(value = {}) {
    const result = Object.create(null);
    for (const key of Object.keys(value || {})) this._ledgerMapSet(result, key, value[key]);
    return result;
  }

  _ledgerMapGet(map, key) {
    if (!map || key === undefined || key === null) return undefined;
    const property = String(key);
    return Object.prototype.hasOwnProperty.call(map, property) ? map[property] : undefined;
  }

  _ledgerMapSet(map, key, value) {
    const property = String(key);
    Object.defineProperty(map, property, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    return value;
  }

  _assertBoundedScalar(value, label, maximumLength, { required = false } = {}) {
    if (value === undefined || value === null) {
      if (required) throw new Error(`${label} is required`);
      return '';
    }
    if (!['string', 'number', 'boolean'].includes(typeof value)) {
      throw new Error(`${label} must be a string, number, or boolean`);
    }
    const text = String(value);
    if (required && text.trim().length === 0) throw new Error(`${label} is required`);
    if (text.length > maximumLength) {
      throw new Error(`${label} exceeds the maximum length of ${maximumLength} characters`);
    }
    return text;
  }

  _assertBoundedValues(value, label, maximumItems, maximumLength) {
    if (value === undefined || value === null) return;
    const values = Array.isArray(value) ? value : [value];
    if (values.length > maximumItems) {
      throw new Error(`${label} exceeds the maximum of ${maximumItems} values`);
    }
    values.forEach((item, index) => {
      this._assertBoundedScalar(item, `${label}[${index}]`, maximumLength);
    });
  }

  _assertSerializableSize(value, label) {
    let serialized;
    try {
      serialized = JSON.stringify(value);
    } catch (_error) {
      throw new Error(`${label} must be JSON serializable`);
    }
    const size =
      typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(serialized).byteLength : serialized.length * 2;
    if (size > this.inputLimits.serializedBytes) {
      throw new Error(`${label} exceeds the maximum serialized size of ${this.inputLimits.serializedBytes} bytes`);
    }
  }

  _validateOperationPayloads(operations, label) {
    if (!Array.isArray(operations)) throw new Error(`${label} must be an array`);
    if (operations.length > this.inputLimits.operations) {
      throw new Error(`${label} exceeds the maximum of ${this.inputLimits.operations} operations`);
    }
    operations.forEach((operation, index) => {
      if (!this._isPlainRecord(operation)) throw new Error(`${label}[${index}] must be a JSON object`);
      this._assertBoundedScalar(operation.op, `${label}[${index}].op`, this.inputLimits.identifierLength, {
        required: true,
      });
      if (operation.field !== undefined) {
        this._assertBoundedScalar(operation.field, `${label}[${index}].field`, this.inputLimits.identifierLength, {
          required: true,
        });
      }
      this._assertBoundedValues(
        operation.value,
        `${label}[${index}].value`,
        this.inputLimits.valuesPerField,
        this.inputLimits.textLength
      );
      if (operation.claimIds !== undefined) {
        if (!Array.isArray(operation.claimIds)) throw new Error(`${label}[${index}].claimIds must be an array`);
        if (operation.claimIds.length > this.inputLimits.referencesPerOperation) {
          throw new Error(
            `${label}[${index}].claimIds exceeds the maximum of ${this.inputLimits.referencesPerOperation} references`
          );
        }
        operation.claimIds.forEach((claimId, claimIndex) => {
          this._assertBoundedScalar(
            claimId,
            `${label}[${index}].claimIds[${claimIndex}]`,
            this.inputLimits.identifierLength,
            { required: true }
          );
        });
      }
    });
  }

  _validateRequestPayloadBounds(params, identityPayload) {
    this._assertSerializableSize(identityPayload, 'Annotation ChangeSet request');
    for (const [field, value] of Object.entries({
      identifier: params.identifier || params.annotationId || params.gene || params.geneSymbol || params.locusTag,
      chromosome: params.chromosome || params.chrom || params.chr,
      idempotencyKey: params.idempotencyKey,
      researchRun: params.researchRun || params.researchRunId,
      manifestHash: params.manifestHash,
    })) {
      if (value !== undefined) {
        this._assertBoundedScalar(value, field, this.inputLimits.identifierLength, { required: true });
      }
    }
    if (params.operations !== undefined) this._validateOperationPayloads(params.operations, 'operations');
    this._assertBoundedValues(
      params.evidence,
      'evidence',
      this.inputLimits.evidenceReferences,
      this.inputLimits.referenceLength
    );

    const proposal = params.annotationProposal || params.proposal;
    if (proposal !== undefined) {
      if (!this._isPlainRecord(proposal)) throw new Error('annotationProposal must be a JSON object');
      if (proposal.operations !== undefined) {
        this._validateOperationPayloads(proposal.operations, 'annotationProposal.operations');
      }
      this._assertBoundedValues(
        proposal.evidence,
        'annotationProposal.evidence',
        this.inputLimits.evidenceReferences,
        this.inputLimits.referenceLength
      );
      this._assertBoundedScalar(proposal.summary, 'annotationProposal.summary', this.inputLimits.textLength);
      this._assertBoundedScalar(proposal.reportUrl, 'annotationProposal.reportUrl', this.inputLimits.referenceLength);
      this._assertBoundedScalar(proposal.detailsUrl, 'annotationProposal.detailsUrl', this.inputLimits.referenceLength);
      if (proposal.claims !== undefined) {
        if (!Array.isArray(proposal.claims)) throw new Error('annotationProposal.claims must be an array');
        if (proposal.claims.length > this.inputLimits.claims) {
          throw new Error(`annotationProposal.claims exceeds the maximum of ${this.inputLimits.claims} claims`);
        }
      }
      if (proposal.evidenceManifest?.sourceRecords !== undefined) {
        if (!Array.isArray(proposal.evidenceManifest.sourceRecords)) {
          throw new Error('annotationProposal.evidenceManifest.sourceRecords must be an array');
        }
        if (proposal.evidenceManifest.sourceRecords.length > this.inputLimits.evidenceRecords) {
          throw new Error(
            `annotationProposal.evidenceManifest.sourceRecords exceeds the maximum of ${this.inputLimits.evidenceRecords} records`
          );
        }
      }
    }

    const updates = params.updates || proposal?.updates;
    if (updates !== undefined) {
      if (!this._isPlainRecord(updates)) throw new Error('updates must be a JSON object');
      const entries = Object.entries(updates);
      if (entries.length > this.inputLimits.operations) {
        throw new Error(`updates exceeds the maximum of ${this.inputLimits.operations} fields`);
      }
      entries.forEach(([field, value]) => {
        this._assertBoundedScalar(field, 'updates field', this.inputLimits.identifierLength, { required: true });
        this._assertBoundedValues(
          value,
          `updates.${field}`,
          this.inputLimits.valuesPerField,
          this.inputLimits.textLength
        );
      });
    }
  }

  _clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  _canonicalise(value) {
    if (Array.isArray(value)) return value.map(item => this._canonicalise(item));
    if (value && typeof value === 'object') {
      const result = Object.create(null);
      for (const key of Object.keys(value).sort()) {
        if (value[key] !== undefined) this._ledgerMapSet(result, key, this._canonicalise(value[key]));
      }
      return result;
    }
    return value;
  }

  _captureWorkspace() {
    const genomePath = this._genomePath();
    const annotations = this.app?.currentAnnotations || null;
    const sourceFeatures = this.app?.sourceFeatures || null;
    const sequences = this.app?.currentSequence || null;
    const key = genomePath || this.app?.currentGenomeName || this.app?.currentChromosome || 'unsaved-genome';
    return Object.freeze({ genomePath, annotations, sourceFeatures, sequences, key });
  }

  _assertWorkspace(workspace) {
    if (
      !workspace ||
      this._genomePath() !== workspace.genomePath ||
      (this.app?.currentAnnotations || null) !== workspace.annotations ||
      (this.app?.sourceFeatures || null) !== workspace.sourceFeatures ||
      (this.app?.currentSequence || null) !== workspace.sequences
    ) {
      throw new Error('The loaded genome workspace changed while the annotation operation was in progress; retry it');
    }
  }

  _assertDurableLedger(workspace) {
    if (
      !workspace.genomePath ||
      !this.app?.sidecarManager ||
      typeof this.app.sidecarManager.get !== 'function' ||
      typeof this.app.sidecarManager.setAndForceSave !== 'function'
    ) {
      throw new Error('Approval and commit require a loaded genome with durable sidecar persistence');
    }
  }

  async _withLedgerLock(operation) {
    const workspace = this._captureWorkspace();
    const key = workspace.key;
    const previous = this.ledgerLocks.get(key) || Promise.resolve();
    let release;
    const gate = new Promise(resolve => {
      release = resolve;
    });
    const tail = previous.catch(() => {}).then(() => gate);
    this.ledgerLocks.set(key, tail);
    await previous.catch(() => {});
    try {
      this._assertWorkspace(workspace);
      const result = await operation(workspace);
      this._assertWorkspace(workspace);
      return result;
    } finally {
      release();
      if (this.ledgerLocks.get(key) === tail) this.ledgerLocks.delete(key);
    }
  }

  _canonicalValuesEqual(left, right) {
    return JSON.stringify(this._canonicalise(left)) === JSON.stringify(this._canonicalise(right));
  }

  _assertLegacyRecordKeys(value, allowed, label) {
    if (!this._isPlainRecord(value)) throw new Error(`${label} must be a JSON object`);
    const unexpected = Object.keys(value).filter(key => !allowed.has(key));
    if (unexpected.length > 0) {
      throw new Error(`${label} contains unsupported legacy fields: ${unexpected.join(', ')}`);
    }
  }

  _legacyGenomePath() {
    return (
      this.app?.currentFile?.path ||
      this.app?.fileManager?.currentFile?.path ||
      this.app?.fileManager?.currentFile?.info?.path ||
      null
    );
  }

  async _legacyFeatureRef(chromosome, annotation, revision) {
    const qualifiers = annotation?.qualifiers || {};
    const locusTag = this._scalar(qualifiers.locus_tag);
    const geneSymbol = this._scalar(qualifiers.gene);
    const proteinId = this._scalar(qualifiers.protein_id);
    const stableInput = {
      chromosome,
      id: annotation?.id || null,
      locusTag,
      proteinId,
      start: annotation?.start,
      end: annotation?.end,
      strand: annotation?.strand,
      type: annotation?.type,
    };
    const featureId = annotation?.codexomicsFeatureId || `feat_${await this._legacyRawSha256(stableInput)}`;
    const featureHash = await this._legacyRawSha256({
      ...stableInput,
      qualifiers,
    });
    const genomeIdentity = this._legacyGenomePath() || this.app?.currentGenomeName || 'unsaved';
    const genomeHash = await this._legacyRawSha256(genomeIdentity);
    return {
      workspaceId: `ws_${genomeHash}`,
      genomeId: `genome_${genomeHash}`,
      annotationRevision: revision,
      featureId,
      featureHash,
      chromosome,
      locusTag: locusTag || null,
      geneSymbol: geneSymbol || null,
      proteinId: proteinId || null,
      coordinates: {
        start: annotation?.start,
        end: annotation?.end,
        strand: annotation?.strand,
      },
      featureType: annotation?.type || null,
    };
  }

  async _legacyStateMatchesTarget(annotation, chromosome, target) {
    const generated = await this._legacyFeatureRef(chromosome, annotation, target.annotationRevision);
    return this._canonicalValuesEqual(generated, target);
  }

  async _findLegacyFeatureByRef(target, workspace) {
    this._assertWorkspace(workspace);
    if (!workspace.annotations) return null;
    const candidates = target.chromosome
      ? [[target.chromosome, workspace.annotations[target.chromosome] || []]]
      : Object.entries(workspace.annotations);
    const matches = [];
    for (const [chromosome, annotations] of candidates) {
      for (const annotation of annotations || []) {
        const ref = await this._legacyFeatureRef(chromosome, annotation, target.annotationRevision);
        if (ref.featureId !== target.featureId) continue;
        const stableFieldsMatch = [
          'workspaceId',
          'genomeId',
          'chromosome',
          'locusTag',
          'geneSymbol',
          'proteinId',
          'featureType',
        ].every(field => this._canonicalValuesEqual(ref[field], target[field]));
        if (stableFieldsMatch && this._canonicalValuesEqual(ref.coordinates, target.coordinates)) {
          matches.push({ chromosome, annotation });
        }
      }
    }
    if (matches.length > 1) {
      throw new Error(`Legacy ChangeSet target ${target.featureId} is ambiguous in the loaded genome`);
    }
    return matches[0] || null;
  }

  _legacyCreationHashPayload(changeSet) {
    const payload = this._clone(changeSet);
    payload.status = 'awaiting_approval';
    delete payload.changeSetHash;
    delete payload.approvalId;
    delete payload.commitReceipt;
    return payload;
  }

  async _verifyLegacyChangeSet(changeSet, mapKey) {
    this._assertLegacyRecordKeys(
      changeSet,
      new Set([
        'schema',
        'id',
        'status',
        'createdAt',
        'createdBy',
        'idempotencyKey',
        'baseRevision',
        'target',
        'evidence',
        'researchRun',
        'manifestHash',
        'operations',
        'riskLevel',
        'requiresHumanApproval',
        'validation',
        'changeSetHash',
        'approvalId',
        'commitReceipt',
      ]),
      `Legacy ChangeSet ${mapKey}`
    );
    if (changeSet.id !== mapKey || changeSet.schema !== 'codexomics.annotation-change-set.v2') {
      throw new Error(`Legacy ChangeSet ${mapKey} has an invalid identity or schema`);
    }
    if (!['awaiting_approval', 'approved', 'stale', 'committed'].includes(changeSet.status)) {
      throw new Error(`Legacy ChangeSet ${changeSet.id} has unsupported status ${changeSet.status}`);
    }
    if (
      !Number.isInteger(changeSet.baseRevision) ||
      changeSet.baseRevision < 0 ||
      typeof changeSet.idempotencyKey !== 'string' ||
      !changeSet.idempotencyKey ||
      !this._isPlainRecord(changeSet.target)
    ) {
      throw new Error(`Legacy ChangeSet ${changeSet.id} has invalid immutable metadata`);
    }
    this._assertLegacyRecordKeys(
      changeSet.target,
      new Set([
        'workspaceId',
        'genomeId',
        'annotationRevision',
        'featureId',
        'featureHash',
        'chromosome',
        'locusTag',
        'geneSymbol',
        'proteinId',
        'coordinates',
        'featureType',
      ]),
      `Legacy ChangeSet ${changeSet.id} target`
    );
    if (
      changeSet.target.annotationRevision !== changeSet.baseRevision ||
      !changeSet.target.workspaceId ||
      !changeSet.target.genomeId ||
      !changeSet.target.featureId ||
      !changeSet.target.featureHash ||
      !changeSet.target.chromosome ||
      !this._isPlainRecord(changeSet.target.coordinates)
    ) {
      throw new Error(`Legacy ChangeSet ${changeSet.id} target is not bound to its creation revision`);
    }
    if (
      !Array.isArray(changeSet.evidence) ||
      changeSet.requiresHumanApproval !== true ||
      !this._isPlainRecord(changeSet.validation)
    ) {
      throw new Error(`Legacy ChangeSet ${changeSet.id} has invalid review metadata`);
    }
    this._validateOperationPayloads(changeSet.operations, `Legacy ChangeSet ${changeSet.id} operations`);
    for (const operation of changeSet.operations) {
      const field =
        operation.op === 'addDbxref'
          ? 'db_xref'
          : operation.op === 'addEvidenceLink'
            ? 'codexomics_research_evidence'
            : operation.field;
      if (!this.allowedOperations.has(operation.op) || !field || !this.allowedQualifierFields.has(field)) {
        throw new Error(`Legacy ChangeSet ${changeSet.id} contains an unsafe annotation operation`);
      }
      if (operation.op !== 'removeQualifier' && this._normaliseValues(operation.value).length === 0) {
        throw new Error(`Legacy ChangeSet ${changeSet.id} contains an empty annotation operation`);
      }
    }
    const expectedHash = await this._legacyHash(
      this._legacyCreationHashPayload(changeSet),
      changeSet.changeSetHash,
      `Legacy ChangeSet ${changeSet.id}`
    );
    if (expectedHash !== changeSet.changeSetHash) {
      throw new Error(`Legacy ChangeSet ${changeSet.id} failed exact creation-payload verification`);
    }
  }

  async _verifyLegacyApproval(approval, mapKey, changeSets) {
    this._assertLegacyRecordKeys(
      approval,
      new Set(['id', 'changeSetId', 'changeSetHash', 'baseRevision', 'approver', 'approvedAt', 'expiresAt', 'token']),
      `Legacy approval ${mapKey}`
    );
    const changeSet = this._ledgerMapGet(changeSets, approval.changeSetId);
    if (
      approval.id !== mapKey ||
      !changeSet ||
      approval.changeSetHash !== changeSet.changeSetHash ||
      approval.baseRevision !== changeSet.baseRevision ||
      typeof approval.approver !== 'string' ||
      !approval.approver.trim() ||
      typeof approval.token !== 'string' ||
      !approval.token
    ) {
      throw new Error(`Legacy approval ${mapKey} has an invalid ChangeSet binding`);
    }
    return changeSet;
  }

  _legacyOperationField(operation) {
    return operation.op === 'addDbxref'
      ? 'db_xref'
      : operation.op === 'addEvidenceLink'
        ? 'codexomics_research_evidence'
        : operation.field;
  }

  async _verifyLegacyReceipt(changeSet, receipt, label) {
    this._assertLegacyRecordKeys(
      receipt,
      new Set([
        'id',
        'changeSetId',
        'committedAt',
        'principal',
        'previousRevision',
        'revision',
        'target',
        'appliedOperations',
        'evidence',
        'manifestHash',
        'receiptHash',
      ]),
      label
    );
    const payload = this._clone(receipt);
    delete payload.receiptHash;
    const expectedHash = await this._legacyHash(payload, receipt.receiptHash, label);
    if (expectedHash !== receipt.receiptHash) throw new Error(`${label} failed exact receipt verification`);
    if (
      receipt.changeSetId !== changeSet.id ||
      receipt.previousRevision !== changeSet.baseRevision ||
      !Number.isInteger(receipt.previousRevision) ||
      receipt.previousRevision < 0 ||
      receipt.revision !== receipt.previousRevision + 1 ||
      !this._canonicalValuesEqual(receipt.target, changeSet.target) ||
      !this._canonicalValuesEqual(receipt.evidence, changeSet.evidence) ||
      !this._canonicalValuesEqual(receipt.manifestHash, changeSet.manifestHash) ||
      !Array.isArray(receipt.appliedOperations) ||
      receipt.appliedOperations.length !== changeSet.operations.length
    ) {
      throw new Error(`${label} is not bound to its reviewed ChangeSet`);
    }
    for (let index = 0; index < receipt.appliedOperations.length; index += 1) {
      const applied = this._clone(receipt.appliedOperations[index]);
      delete applied.oldValue;
      if (!this._canonicalValuesEqual(applied, changeSet.operations[index])) {
        throw new Error(`${label} operations differ from the reviewed legacy payload`);
      }
    }
  }

  async _forwardLegacyReceipt(preState, changeSet, receipt, chromosome) {
    if (!(await this._legacyStateMatchesTarget(preState, chromosome, changeSet.target))) {
      throw new Error(`Legacy ChangeSet ${changeSet.id} pre-state does not match its target hash`);
    }
    const postState = this._clone(preState);
    for (const operation of receipt.appliedOperations) {
      const field = this._legacyOperationField(operation);
      const actualOldValue = postState.qualifiers?.[field];
      const recordedOldValue = Object.prototype.hasOwnProperty.call(operation, 'oldValue')
        ? operation.oldValue
        : undefined;
      if (!this._canonicalValuesEqual(actualOldValue, recordedOldValue)) {
        throw new Error(`Legacy ChangeSet ${changeSet.id} receipt oldValue does not match the proven pre-state`);
      }
      this._applyOperation(postState, operation);
    }
    return postState;
  }

  async _reverseLegacyReceipt(postState, changeSet, receipt, chromosome) {
    const preState = this._clone(postState);
    if (!preState.qualifiers) preState.qualifiers = {};
    for (let index = receipt.appliedOperations.length - 1; index >= 0; index -= 1) {
      const operation = receipt.appliedOperations[index];
      const field = this._legacyOperationField(operation);
      if (Object.prototype.hasOwnProperty.call(operation, 'oldValue') && operation.oldValue !== undefined) {
        preState.qualifiers[field] = this._clone(operation.oldValue);
      } else {
        delete preState.qualifiers[field];
      }
    }
    if (!(await this._legacyStateMatchesTarget(preState, chromosome, changeSet.target))) {
      throw new Error(`Legacy ChangeSet ${changeSet.id} cannot be reversibly bound to its target hash`);
    }
    const replayed = await this._forwardLegacyReceipt(preState, changeSet, receipt, chromosome);
    if (!this._canonicalValuesEqual(replayed, postState)) {
      throw new Error(`Legacy ChangeSet ${changeSet.id} post-state is not a deterministic receipt result`);
    }
    return preState;
  }

  async _reconstructLegacyFeatureChain(chain, found) {
    const candidates = [];
    for (let boundary = 0; boundary <= chain.length; boundary += 1) {
      const states = new Array(chain.length + 1);
      states[boundary] = this._clone(found.annotation);
      try {
        if (
          boundary < chain.length &&
          !(await this._legacyStateMatchesTarget(states[boundary], found.chromosome, chain[boundary].target))
        ) {
          continue;
        }
        for (let index = boundary - 1; index >= 0; index -= 1) {
          states[index] = await this._reverseLegacyReceipt(
            states[index + 1],
            chain[index],
            chain[index].commitReceipt,
            found.chromosome
          );
        }
        for (let index = boundary; index < chain.length; index += 1) {
          states[index + 1] = await this._forwardLegacyReceipt(
            states[index],
            chain[index],
            chain[index].commitReceipt,
            found.chromosome
          );
        }
        for (let index = 0; index < chain.length; index += 1) {
          if (!(await this._legacyStateMatchesTarget(states[index], found.chromosome, chain[index].target))) {
            throw new Error(`Legacy ChangeSet ${chain[index].id} does not form a continuous feature chain`);
          }
        }
        candidates.push(states);
      } catch (_error) {
        // Try another exact chain boundary. No candidate is accepted unless
        // every reverse and forward proof succeeds.
      }
    }
    if (candidates.length === 0) {
      throw new Error(
        `Legacy committed feature ${chain[0].target.featureId} is neither at a proven pre-state nor a reversible receipt post-state`
      );
    }
    const canonical = JSON.stringify(this._canonicalise(candidates[0]));
    if (candidates.some(candidate => JSON.stringify(this._canonicalise(candidate)) !== canonical)) {
      throw new Error(`Legacy committed feature ${chain[0].target.featureId} has an ambiguous migration state`);
    }
    return candidates[0];
  }

  async _validateMigratedCommittedHistory(ledger) {
    const committed = Object.values(ledger.changeSets)
      .filter(changeSet => changeSet?.status === 'committed')
      .sort((left, right) => left.commitReceipt.revision - right.commitReceipt.revision);
    for (const changeSet of committed) await this._validateCommittedRecord(changeSet);
    this._validateCommittedIdempotencyIndex(ledger, committed);
    for (let index = 0; index < committed.length; index += 1) {
      if (
        committed[index].commitReceipt.previousRevision !== index ||
        committed[index].commitReceipt.revision !== index + 1
      ) {
        throw new Error('Migrated annotation receipts are not unique and contiguous');
      }
    }
    if (ledger.revision !== committed.length) {
      throw new Error('Migrated annotation ledger revision does not match its committed history');
    }
  }

  async _validateMigratedOverlayProof(ledger, provenStates, workspace) {
    for (const changeSet of Object.values(ledger.changeSets)) {
      if (changeSet.status !== 'committed') continue;
      const proven = provenStates.get(changeSet.id);
      if (!proven?.preState || !proven?.postState) {
        throw new Error(`Migrated committed ChangeSet ${changeSet.id} is missing its detached state proof`);
      }
      const target = await this._featureRef(
        proven.chromosome,
        proven.preState,
        { revision: changeSet.baseRevision },
        workspace
      );
      if (!this._canonicalValuesEqual(target, changeSet.target)) {
        throw new Error(`Migrated committed ChangeSet ${changeSet.id} target failed detached verification`);
      }
      const replayed = this._clone(proven.preState);
      for (const operation of changeSet.commitReceipt.appliedOperations) {
        this._applyOperation(replayed, operation);
      }
      if (!this._canonicalValuesEqual(replayed, proven.postState)) {
        throw new Error(`Migrated committed ChangeSet ${changeSet.id} failed detached operation replay`);
      }
      const resulting = await this._featureRef(
        proven.chromosome,
        replayed,
        { revision: changeSet.commitReceipt.revision },
        workspace
      );
      if (resulting.featureHash !== changeSet.commitReceipt.resultingFeatureHash) {
        throw new Error(`Migrated committed ChangeSet ${changeSet.id} resulting hash failed detached verification`);
      }
    }
  }

  async _migrateLegacyV2Ledger(ledger, rawLedger, workspace) {
    this._assertWorkspace(workspace);
    this._assertDurableLedger(workspace);
    this._assertLegacyRecordKeys(
      rawLedger,
      new Set([
        'schema',
        'revision',
        'changeSets',
        'approvals',
        'audit',
        'committedIdempotencyKeys',
        'createdAt',
        'updatedAt',
      ]),
      'Legacy annotation ledger'
    );
    const sourceLedgerSha256 = await this._legacyRawSha256(rawLedger);
    const migrated = this._clone(ledger);
    migrated.changeSets = this._createLedgerMap(migrated.changeSets);
    migrated.approvals = this._createLedgerMap(migrated.approvals);
    migrated.idempotencyKeys = this._createLedgerMap();
    migrated.committedIdempotencyKeys = this._createLedgerMap(migrated.committedIdempotencyKeys);

    const legacyHashes = new Map();
    const idempotencyOwners = new Map();
    for (const [mapKey, changeSet] of Object.entries(migrated.changeSets)) {
      await this._verifyLegacyChangeSet(changeSet, mapKey);
      legacyHashes.set(changeSet.id, changeSet.changeSetHash);
      if (!idempotencyOwners.has(changeSet.idempotencyKey)) {
        idempotencyOwners.set(changeSet.idempotencyKey, []);
      }
      idempotencyOwners.get(changeSet.idempotencyKey).push(changeSet);
    }

    const ambiguousIdempotencyGroups = new Map();
    const ambiguityByChangeSet = new Map();
    const reservedIdempotencyKeys = new Set(idempotencyOwners.keys());
    for (const [originalKey, owners] of idempotencyOwners.entries()) {
      if (owners.length < 2) continue;
      const committedOwners = owners.filter(changeSet => changeSet.status === 'committed');
      if (committedOwners.length > 1) {
        throw new Error(`Legacy idempotency key ${originalKey} has multiple impossible committed owners`);
      }
      const ownerIds = owners.map(changeSet => changeSet.id).sort();
      const group = {
        originalKey,
        ownerIds,
        committedOwnerId: committedOwners[0]?.id || null,
      };
      ambiguousIdempotencyGroups.set(originalKey, group);
      for (const changeSet of owners) {
        let migratedKey = originalKey;
        if (changeSet.status !== 'committed') {
          const digest = await this._hash({ originalKey, changeSetId: changeSet.id });
          migratedKey = `legacy-ambiguous-owner:${digest}`;
          let suffix = 1;
          while (reservedIdempotencyKeys.has(migratedKey)) {
            migratedKey = `legacy-ambiguous-owner:${digest}:${suffix}`;
            suffix += 1;
          }
          reservedIdempotencyKeys.add(migratedKey);
          changeSet.idempotencyKey = migratedKey;
        }
        ambiguityByChangeSet.set(changeSet.id, {
          originalKey,
          ownerIds,
          migratedKey,
          readOnly: changeSet.status !== 'committed',
        });
      }
    }

    const approvalsByChangeSet = new Map();
    for (const [mapKey, approval] of Object.entries(migrated.approvals)) {
      const changeSet = await this._verifyLegacyApproval(approval, mapKey, migrated.changeSets);
      if (approvalsByChangeSet.has(changeSet.id)) {
        throw new Error(`Legacy ChangeSet ${changeSet.id} has multiple approval capabilities`);
      }
      approvalsByChangeSet.set(changeSet.id, approval);
    }
    for (const changeSet of Object.values(migrated.changeSets)) {
      const approval = approvalsByChangeSet.get(changeSet.id);
      if (changeSet.status === 'awaiting_approval') {
        if (approval || changeSet.approvalId || changeSet.commitReceipt) {
          throw new Error(`Legacy awaiting-review ChangeSet ${changeSet.id} has unexpected post-creation state`);
        }
      } else if (!approval || changeSet.approvalId !== approval.id) {
        throw new Error(`Legacy ChangeSet ${changeSet.id} is missing its bound approval record`);
      }
      if (changeSet.status !== 'committed' && changeSet.commitReceipt) {
        throw new Error(`Legacy non-committed ChangeSet ${changeSet.id} contains an unexpected commit receipt`);
      }
    }
    for (const changeSetId of ambiguityByChangeSet.keys()) {
      const changeSet = this._ledgerMapGet(migrated.changeSets, changeSetId);
      if (changeSet.status !== 'committed') {
        changeSet.status = 'stale';
      }
    }

    const committed = Object.values(migrated.changeSets)
      .filter(changeSet => changeSet.status === 'committed')
      .sort((left, right) => left.commitReceipt?.revision - right.commitReceipt?.revision);
    if (Object.keys(migrated.committedIdempotencyKeys).length !== committed.length) {
      throw new Error('Legacy committed idempotency index is not bidirectional');
    }
    for (let index = 0; index < committed.length; index += 1) {
      const changeSet = committed[index];
      const approval = approvalsByChangeSet.get(changeSet.id);
      if (
        !approval ||
        changeSet.approvalId !== approval.id ||
        changeSet.commitReceipt?.previousRevision !== index ||
        changeSet.commitReceipt?.revision !== index + 1 ||
        changeSet.baseRevision !== index ||
        changeSet.commitReceipt?.principal !== approval.approver
      ) {
        throw new Error(`Legacy committed ChangeSet ${changeSet.id} has an invalid approval or revision chain`);
      }
      await this._verifyLegacyReceipt(changeSet, changeSet.commitReceipt, `Legacy receipt for ${changeSet.id}`);
      const indexed = this._ledgerMapGet(migrated.committedIdempotencyKeys, changeSet.idempotencyKey);
      if (!indexed) throw new Error(`Legacy committed ChangeSet ${changeSet.id} is missing its receipt index`);
      await this._verifyLegacyReceipt(changeSet, indexed, `Legacy indexed receipt for ${changeSet.id}`);
      if (!this._canonicalValuesEqual(indexed, changeSet.commitReceipt)) {
        throw new Error(`Legacy committed ChangeSet ${changeSet.id} receipt index diverges from its record`);
      }
    }
    if (migrated.revision !== committed.length) {
      throw new Error('Legacy annotation ledger revision does not match its committed receipt history');
    }
    for (const [idempotencyKey, indexed] of Object.entries(migrated.committedIdempotencyKeys)) {
      const owner = this._ledgerMapGet(migrated.changeSets, indexed?.changeSetId);
      if (!owner || owner.status !== 'committed' || owner.idempotencyKey !== idempotencyKey) {
        throw new Error(`Legacy committed idempotency entry ${idempotencyKey} has no committed owner`);
      }
    }

    const chains = new Map();
    for (const changeSet of committed) {
      const key = JSON.stringify([changeSet.target.genomeId, changeSet.target.chromosome, changeSet.target.featureId]);
      if (!chains.has(key)) chains.set(key, []);
      chains.get(key).push(changeSet);
    }
    const provenStates = new Map();
    for (const chain of chains.values()) {
      chain.sort((left, right) => left.commitReceipt.revision - right.commitReceipt.revision);
      const found = await this._findLegacyFeatureByRef(chain[0].target, workspace);
      if (!found) {
        throw new Error(`Legacy committed target ${chain[0].target.featureId} is missing from the loaded genome`);
      }
      const states = await this._reconstructLegacyFeatureChain(chain, found);
      chain.forEach((changeSet, index) => {
        provenStates.set(changeSet.id, {
          chromosome: found.chromosome,
          preState: states[index],
          postState: states[index + 1],
        });
      });
    }

    for (const changeSet of Object.values(migrated.changeSets)) {
      let proven = provenStates.get(changeSet.id);
      if (!proven) {
        const found = await this._findLegacyFeatureByRef(changeSet.target, workspace);
        const liveTargetMatches = Boolean(
          found && (await this._legacyStateMatchesTarget(found.annotation, found.chromosome, changeSet.target))
        );
        if (!liveTargetMatches && changeSet.status !== 'stale') {
          throw new Error(`Legacy pending ChangeSet ${changeSet.id} target cannot be proven against the loaded genome`);
        }
        if (liveTargetMatches) {
          proven = {
            chromosome: found.chromosome,
            preState: this._clone(found.annotation),
            postState: null,
          };
        }
      }
      const legacyTarget = this._clone(changeSet.target);
      const modernTarget = proven
        ? await this._featureRef(proven.chromosome, proven.preState, { revision: changeSet.baseRevision }, workspace)
        : legacyTarget;
      changeSet.hashVersion = this.hashVersions.current;
      changeSet.legacyIntegrity = {
        hashVersion: this.hashVersions.legacy,
        changeSetHash: legacyHashes.get(changeSet.id),
        target: legacyTarget,
        ...(ambiguityByChangeSet.has(changeSet.id)
          ? { idempotencyAmbiguity: this._clone(ambiguityByChangeSet.get(changeSet.id)) }
          : {}),
      };
      changeSet.requestHash = null;
      changeSet.proposalBaseRevision = changeSet.baseRevision;
      changeSet.evidenceManifest = null;
      changeSet.claims = [];
      changeSet.proposalMetadata = null;
      changeSet.target = modernTarget;
      changeSet.targetFormat = proven ? 'current-v2' : 'legacy-v2-read-only';
      if (changeSet.status === 'approved') {
        changeSet.status = 'awaiting_approval';
        delete changeSet.approvalId;
      }
      if (changeSet.status === 'committed') {
        const receipt = changeSet.commitReceipt;
        const legacyReceiptHash = receipt.receiptHash;
        receipt.hashVersion = this.hashVersions.current;
        receipt.legacyIntegrity = {
          hashVersion: this.hashVersions.legacy,
          receiptHash: legacyReceiptHash,
          target: this._clone(receipt.target),
        };
        receipt.approvedBy = approvalsByChangeSet.get(changeSet.id).approver;
        receipt.target = modernTarget;
        receipt.resultingFeatureHash = (
          await this._featureRef(proven.chromosome, proven.postState, { revision: receipt.revision }, workspace)
        ).featureHash;
        delete receipt.receiptHash;
        receipt.receiptHash = await this._hash(receipt);
      }
      changeSet.changeSetHash = await this._hash(this._immutableChangeSetPayload(changeSet));
      this._ledgerMapSet(migrated.idempotencyKeys, changeSet.idempotencyKey, {
        changeSetId: changeSet.id,
        requestHash: null,
        legacyOpaque: true,
      });
    }
    for (const [originalKey, group] of ambiguousIdempotencyGroups.entries()) {
      this._ledgerMapSet(migrated.idempotencyKeys, originalKey, {
        legacyAmbiguous: true,
        legacyOpaque: true,
        ownerIds: this._clone(group.ownerIds),
        committedOwnerId: group.committedOwnerId,
      });
    }

    const migratedAt = new Date().toISOString();
    for (const approval of Object.values(migrated.approvals)) {
      const changeSet = this._ledgerMapGet(migrated.changeSets, approval.changeSetId);
      approval.legacyChangeSetHash = approval.changeSetHash;
      approval.changeSetHash = changeSet.changeSetHash;
      approval.source = 'legacy-v2-migrated';
      approval.revokedAt = migratedAt;
      approval.revokedBy = 'legacy-ledger-migration';
      approval.revocationReason = 'legacy_plaintext_capability_revoked';
      delete approval.token;
      delete approval.tokenHash;
      if (changeSet.status !== 'committed' && changeSet.approvalId === approval.id) {
        delete changeSet.approvalId;
      }
      migrated.audit.push({
        id: this._id('audit'),
        event: 'annotation_approval_revoked',
        changeSetId: changeSet.id,
        approvalId: approval.id,
        principal: 'legacy-ledger-migration',
        timestamp: migratedAt,
        reason: approval.revocationReason,
      });
    }
    for (const group of ambiguousIdempotencyGroups.values()) {
      migrated.audit.push({
        id: this._id('audit'),
        event: 'annotation_legacy_idempotency_ambiguous',
        principal: 'legacy-ledger-migration',
        timestamp: migratedAt,
        originalKey: group.originalKey,
        ownerIds: this._clone(group.ownerIds),
        committedOwnerId: group.committedOwnerId,
        resolution: 'uncommitted_owners_preserved_as_stale_read_only_history',
      });
    }

    migrated.committedIdempotencyKeys = this._createLedgerMap();
    for (const changeSet of Object.values(migrated.changeSets)) {
      if (changeSet.status === 'committed') {
        this._ledgerMapSet(
          migrated.committedIdempotencyKeys,
          changeSet.idempotencyKey,
          this._clone(changeSet.commitReceipt)
        );
      }
    }
    migrated.integrityVersion = this.integrityVersion;
    migrated.migration = {
      fromIntegrityVersion: 1,
      migratedAt,
      sourceLedgerSha256,
      legacyHashVersion: this.hashVersions.legacy,
      currentHashVersion: this.hashVersions.current,
    };
    migrated.audit.push({
      id: this._id('audit'),
      event: 'annotation_ledger_integrity_migrated',
      principal: 'legacy-ledger-migration',
      timestamp: migratedAt,
      sourceLedgerSha256,
    });
    this._assertLedgerCapacity(migrated);
    await this._validateMigratedCommittedHistory(migrated);
    await this._validateMigratedOverlayProof(migrated, provenStates, workspace);
    this._assertWorkspace(workspace);
    return this._normaliseLedger(migrated);
  }

  async _loadLedger(workspace) {
    this._assertWorkspace(workspace);
    const genomePath = workspace.genomePath;
    const sidecar = this.app?.sidecarManager;
    if (genomePath && sidecar && typeof sidecar.get === 'function') {
      const rawLedger = this._clone(await sidecar.get(genomePath, 'annotationCuration', { strict: true }));
      let ledger = this._normaliseLedger(rawLedger);
      this._assertWorkspace(workspace);
      if (ledger.integrityVersion === undefined) {
        ledger = await this._migrateLegacyV2Ledger(ledger, rawLedger, workspace);
        this._assertWorkspace(workspace);
        // The upgraded hashes and revoked plaintext capabilities must reach
        // durable storage before reconciliation is allowed to touch live data.
        await this._saveLedger(ledger, workspace);
        this._assertWorkspace(workspace);
      }
      await this._reconcileCommittedChanges(ledger, workspace);
      this._assertWorkspace(workspace);
      this.memoryLedgers.set(workspace.key, this._clone(ledger));
      return ledger;
    }
    const key = workspace.key;
    if (!this.memoryLedgers.has(key)) this.memoryLedgers.set(key, this._newLedger());
    return this._clone(this.memoryLedgers.get(key));
  }

  async _validateCommittedRecord(changeSet) {
    if (changeSet?.schema !== 'codexomics.annotation-change-set.v2') {
      throw new Error(`Committed ChangeSet ${changeSet?.id || 'unknown'} has an unsupported schema`);
    }
    if (changeSet.hashVersion !== this.hashVersions.current || changeSet.targetFormat !== 'current-v2') {
      throw new Error(`Committed ChangeSet ${changeSet.id} has an unsupported hash version`);
    }
    const expectedChangeSetHash = await this._hash(this._immutableChangeSetPayload(changeSet));
    if (!changeSet.changeSetHash || expectedChangeSetHash !== changeSet.changeSetHash) {
      throw new Error(`Committed ChangeSet ${changeSet.id} failed immutable payload verification`);
    }

    const receipt = changeSet.commitReceipt;
    const proposalBaseRevision = changeSet.proposalBaseRevision ?? changeSet.baseRevision;
    if (!receipt || typeof receipt !== 'object') {
      throw new Error(`Committed ChangeSet ${changeSet.id} is missing its commit receipt`);
    }
    if (
      receipt.hashVersion !== this.hashVersions.current ||
      receipt.changeSetId !== changeSet.id ||
      !Number.isInteger(changeSet.baseRevision) ||
      changeSet.baseRevision < 0 ||
      !Number.isInteger(proposalBaseRevision) ||
      proposalBaseRevision < 0 ||
      proposalBaseRevision > changeSet.baseRevision ||
      !Number.isInteger(receipt.previousRevision) ||
      receipt.previousRevision < changeSet.baseRevision ||
      !Number.isInteger(receipt.revision) ||
      receipt.revision !== receipt.previousRevision + 1 ||
      typeof receipt.resultingFeatureHash !== 'string' ||
      receipt.resultingFeatureHash.length === 0
    ) {
      throw new Error(`Committed ChangeSet ${changeSet.id} has an invalid commit receipt`);
    }
    if ((await this._hash(receipt.target)) !== (await this._hash(changeSet.target))) {
      throw new Error(`Committed ChangeSet ${changeSet.id} receipt target does not match its reviewed target`);
    }
    const receiptPayload = this._clone(receipt);
    delete receiptPayload.receiptHash;
    if (!receipt.receiptHash || (await this._hash(receiptPayload)) !== receipt.receiptHash) {
      throw new Error(`Committed ChangeSet ${changeSet.id} failed receipt integrity verification`);
    }
    if (
      !Array.isArray(changeSet.operations) ||
      changeSet.operations.length === 0 ||
      !Array.isArray(receipt.appliedOperations) ||
      receipt.appliedOperations.length !== changeSet.operations.length
    ) {
      throw new Error(`Committed ChangeSet ${changeSet.id} has an invalid applied-operation receipt`);
    }
    for (let index = 0; index < receipt.appliedOperations.length; index += 1) {
      const applied = this._clone(receipt.appliedOperations[index]);
      delete applied.oldValue;
      const expected = changeSet.operations[index];
      const field =
        applied.op === 'addDbxref'
          ? 'db_xref'
          : applied.op === 'addEvidenceLink'
            ? 'codexomics_research_evidence'
            : applied.field;
      if (
        !this.allowedOperations.has(applied.op) ||
        !field ||
        !this.allowedQualifierFields.has(field) ||
        (applied.op !== 'removeQualifier' && this._normaliseValues(applied.value).length === 0)
      ) {
        throw new Error(`Committed ChangeSet ${changeSet.id} receipt contains an unsafe annotation operation`);
      }
      if ((await this._hash(applied)) !== (await this._hash(expected))) {
        throw new Error(`Committed ChangeSet ${changeSet.id} receipt operations differ from the reviewed payload`);
      }
    }
  }

  _assertIndexedCommitReceipt(changeSet, indexedReceipt, idempotencyKey = changeSet?.idempotencyKey) {
    const committedReceipt = changeSet?.commitReceipt;
    const indexedPayload =
      indexedReceipt && typeof indexedReceipt === 'object' ? JSON.stringify(this._canonicalise(indexedReceipt)) : null;
    const committedPayload =
      committedReceipt && typeof committedReceipt === 'object'
        ? JSON.stringify(this._canonicalise(committedReceipt))
        : null;
    if (
      changeSet?.status !== 'committed' ||
      !idempotencyKey ||
      idempotencyKey !== changeSet.idempotencyKey ||
      !indexedReceipt ||
      indexedReceipt.changeSetId !== changeSet.id ||
      !indexedReceipt.receiptHash ||
      indexedReceipt.receiptHash !== committedReceipt?.receiptHash ||
      indexedPayload !== committedPayload
    ) {
      throw new Error(
        `Annotation ledger committed idempotency index is inconsistent for ChangeSet ${changeSet?.id || 'unknown'}`
      );
    }
  }

  _validateCommittedIdempotencyIndex(ledger, committed) {
    for (const changeSet of committed) {
      const indexedReceipt = this._ledgerMapGet(ledger.committedIdempotencyKeys, changeSet.idempotencyKey);
      this._assertIndexedCommitReceipt(changeSet, indexedReceipt);
    }
    for (const [idempotencyKey, indexedReceipt] of Object.entries(ledger.committedIdempotencyKeys)) {
      const changeSet = this._ledgerMapGet(ledger.changeSets, indexedReceipt?.changeSetId);
      this._assertIndexedCommitReceipt(changeSet, indexedReceipt, idempotencyKey);
    }
  }

  async _reconcileCommittedChanges(ledger, workspace) {
    this._assertWorkspace(workspace);
    const allChangeSets = Object.values(ledger.changeSets);
    const committed = allChangeSets.filter(changeSet => changeSet?.status === 'committed');
    for (const changeSet of committed) {
      await this._validateCommittedRecord(changeSet);
      this._assertWorkspace(workspace);
    }
    this._validateCommittedIdempotencyIndex(ledger, committed);
    committed.sort((left, right) => left.commitReceipt.revision - right.commitReceipt.revision);
    for (let index = 0; index < committed.length; index += 1) {
      if (
        committed[index].commitReceipt.previousRevision !== index ||
        committed[index].commitReceipt.revision !== index + 1 ||
        committed[index].baseRevision > committed[index].commitReceipt.previousRevision ||
        (committed[index].proposalBaseRevision ?? committed[index].baseRevision) > committed[index].baseRevision
      ) {
        throw new Error('Annotation ledger committed receipt revisions must be unique and contiguous');
      }
    }
    const highestCommittedRevision = committed.length > 0 ? committed[committed.length - 1].commitReceipt.revision : 0;
    if (highestCommittedRevision !== ledger.revision) {
      throw new Error('Annotation ledger revision does not match its committed receipt history');
    }
    const chains = new Map();
    for (const changeSet of committed) {
      const chainKey = JSON.stringify([
        changeSet.target.genomeId,
        changeSet.target.chromosome,
        changeSet.target.featureId,
      ]);
      if (!chains.has(chainKey)) chains.set(chainKey, []);
      chains.get(chainKey).push(changeSet);
    }

    const pendingSwaps = [];
    for (const chain of chains.values()) {
      const found = await this._findFeatureByRef(chain[0].target, workspace);
      if (!found) throw new Error(`Committed ChangeSet ${chain[0].id} target is missing from the loaded genome`);
      const liveSnapshot = JSON.stringify(this._canonicalise(found.annotation));
      const workingAnnotation = this._clone(found.annotation);
      let currentRef = await this._featureRef(found.chromosome, workingAnnotation, ledger, workspace);
      let replayIndex = -1;
      for (let index = 0; index < chain.length; index += 1) {
        const changeSet = chain[index];
        if (currentRef.featureHash === changeSet.target.featureHash) replayIndex = index;
        if (currentRef.featureHash === changeSet.commitReceipt.resultingFeatureHash) {
          replayIndex = index + 1;
        }
      }
      if (replayIndex < 0) {
        throw new Error(
          `Committed ChangeSet chain for ${chain[0].target.featureId} conflicts with the loaded genome; resolve the sidecar/source annotation divergence before continuing`
        );
      }

      for (let index = replayIndex; index < chain.length; index += 1) {
        const changeSet = chain[index];
        const receipt = changeSet.commitReceipt;
        currentRef = await this._featureRef(found.chromosome, workingAnnotation, ledger, workspace);
        if (currentRef.featureHash !== changeSet.target.featureHash) {
          throw new Error(`Committed ChangeSet ${changeSet.id} does not form a continuous feature-hash chain`);
        }
        for (const operation of receipt.appliedOperations) {
          this._applyOperation(workingAnnotation, operation);
        }
        const resultingRef = await this._featureRef(found.chromosome, workingAnnotation, ledger, workspace);
        if (resultingRef.featureHash !== receipt.resultingFeatureHash) {
          throw new Error(`Committed ChangeSet ${changeSet.id} failed deterministic overlay verification`);
        }
      }
      if (replayIndex < chain.length) {
        pendingSwaps.push({ liveAnnotation: found.annotation, liveSnapshot, workingAnnotation });
      }
    }

    this._assertWorkspace(workspace);
    if (
      pendingSwaps.some(pending => JSON.stringify(this._canonicalise(pending.liveAnnotation)) !== pending.liveSnapshot)
    ) {
      throw new Error(
        'A live annotation changed while the committed overlay was being verified; retry the genome load'
      );
    }
    for (const pending of pendingSwaps) {
      Object.keys(pending.liveAnnotation).forEach(key => delete pending.liveAnnotation[key]);
      Object.assign(pending.liveAnnotation, pending.workingAnnotation);
    }
  }

  async _saveLedger(ledger, workspace) {
    this._assertWorkspace(workspace);
    ledger.updatedAt = new Date().toISOString();
    this._assertLedgerCapacity(ledger);
    const genomePath = workspace.genomePath;
    const sidecar = this.app?.sidecarManager;
    const snapshot = this._clone(ledger);
    if (genomePath && sidecar && typeof sidecar.setAndForceSave === 'function') {
      await sidecar.setAndForceSave(genomePath, 'annotationCuration', snapshot);
    } else if (genomePath && sidecar && typeof sidecar.set === 'function') {
      await sidecar.set(genomePath, 'annotationCuration', snapshot);
      if (typeof sidecar.forceSave === 'function') await sidecar.forceSave(genomePath);
    }
    this._assertWorkspace(workspace);
    this.memoryLedgers.set(workspace.key, snapshot);
  }

  async _hash(value) {
    const input = JSON.stringify(this._canonicalise(value));
    return this._hashSerialized(input);
  }

  async _legacyHash(value, storedHash, label = 'Legacy annotation record') {
    if (typeof storedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(storedHash)) {
      if (typeof storedHash === 'string' && storedHash.startsWith('fnv1a-')) {
        throw new Error(`${label} uses weak legacy FNV integrity and requires manual reconciliation`);
      }
      throw new Error(`${label} is missing a valid legacy SHA-256 hash`);
    }
    if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') {
      throw new Error('Secure WebCrypto SHA-256 is required to migrate a legacy annotation ledger');
    }
    return this._legacyRawSha256(value);
  }

  async _legacyRawSha256(value) {
    return this._hashSerialized(JSON.stringify(value), { requireSha256: true });
  }

  async _hashSerialized(input, { requireSha256 = false } = {}) {
    if (globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(input);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    }
    if (requireSha256) throw new Error('Secure WebCrypto SHA-256 is required for legacy annotation migration');
    // Fallback is for older Electron renderers only; it is never used as an
    // authentication secret.
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a-${(hash >>> 0).toString(16)}`;
  }

  async _secureCapabilityHash(value) {
    if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') {
      throw new Error('Secure WebCrypto SHA-256 is required for annotation approval capabilities');
    }
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  async _assemblyDigest(workspace) {
    this._assertWorkspace(workspace);
    const sequences = workspace.sequences;
    if (!sequences || typeof sequences !== 'object' || Object.keys(sequences).length === 0) {
      return 'assembly-unavailable';
    }
    const digest = await this._hash({
      sequences: Object.keys(sequences)
        .sort()
        .map(chromosome => [chromosome, String(sequences[chromosome] || '').toUpperCase()]),
    });
    this._assertWorkspace(workspace);
    return digest;
  }

  async _proteinDigest(annotation) {
    const translation = this._scalar(annotation?.qualifiers?.translation).replace(/\s+/g, '').toUpperCase();
    return translation ? this._hash({ proteinSequence: translation }) : null;
  }

  _stableFeatureIdentity(chromosome, annotation) {
    const qualifiers = annotation.qualifiers || {};
    return {
      chromosome,
      id: annotation.id || null,
      locusTag: this._scalar(this._qualifierValue(qualifiers, ['locus_tag', 'locusTag', 'ID', 'gene_id'])),
      proteinId: this._scalar(this._qualifierValue(qualifiers, ['protein_id', 'proteinId'])),
      start: annotation.start,
      end: annotation.end,
      strand: annotation.strand,
      type: annotation.type,
    };
  }

  _id(prefix) {
    const random = globalThis.crypto?.getRandomValues
      ? Array.from(globalThis.crypto.getRandomValues(new Uint32Array(2)))
          .map(value => value.toString(36))
          .join('')
      : Math.random().toString(36).slice(2);
    return `${prefix}_${Date.now().toString(36)}_${random}`;
  }

  _approvalToken() {
    if (!globalThis.crypto?.getRandomValues) {
      throw new Error('Secure random generation is required for annotation approval capabilities');
    }
    return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  _scalar(value) {
    return Array.isArray(value) ? value[0] || '' : value || '';
  }

  _qualifierValue(qualifiers, names) {
    for (const name of names) {
      if (qualifiers?.[name] !== undefined && qualifiers?.[name] !== null && qualifiers?.[name] !== '') {
        return qualifiers[name];
      }
    }
    return '';
  }

  _annotationIdentifiers(annotation) {
    const qualifiers = annotation?.qualifiers || {};
    const values = [
      annotation?.id,
      annotation?.name,
      this._qualifierValue(qualifiers, ['gene', 'gene_name', 'Gene']),
      this._qualifierValue(qualifiers, ['locus_tag', 'locusTag']),
      this._qualifierValue(qualifiers, ['protein_id', 'proteinId']),
      this._qualifierValue(qualifiers, ['ID', 'id']),
      this._qualifierValue(qualifiers, ['Name', 'name']),
      this._qualifierValue(qualifiers, ['gene_id', 'geneId']),
      this._qualifierValue(qualifiers, ['transcript_id', 'transcriptId']),
      this._qualifierValue(qualifiers, ['Alias', 'alias']),
    ];
    return values
      .flat()
      .flatMap(value => String(value || '').split(','))
      .map(value => value.trim())
      .filter(Boolean);
  }

  async _featureRef(chromosome, annotation, ledger, workspace) {
    this._assertWorkspace(workspace);
    const qualifiers = annotation.qualifiers || {};
    const locusTag = this._scalar(this._qualifierValue(qualifiers, ['locus_tag', 'locusTag', 'ID', 'gene_id']));
    const geneSymbol = this._scalar(this._qualifierValue(qualifiers, ['gene', 'gene_name', 'Name', 'Gene']));
    const proteinId = this._scalar(this._qualifierValue(qualifiers, ['protein_id', 'proteinId']));
    const stableIdentity = this._stableFeatureIdentity(chromosome, annotation);
    const structuralInput = {
      ...stableIdentity,
      phase: annotation.phase ?? null,
      score: annotation.score ?? null,
      source: annotation.source ?? null,
      frame: annotation.frame ?? null,
      location: annotation.location ?? null,
      segments: annotation.segments ?? null,
    };
    const featureId = annotation.codexomicsFeatureId || `feat_${await this._hash(stableIdentity)}`;
    const assemblyDigest = await this._assemblyDigest(workspace);
    const featureHash = await this._hash({
      ...structuralInput,
      assemblyDigest,
      qualifiers: annotation.qualifiers || {},
    });
    const genomePath = workspace.genomePath;
    const sourceFeature = workspace.sourceFeatures?.[chromosome] || {};
    const sourceDbXrefs = this._normaliseValues(sourceFeature.db_xref || sourceFeature.qualifiers?.db_xref);
    const taxonXref = sourceDbXrefs.find(value => /^taxon:\d+$/i.test(value));
    const organism =
      sourceFeature.organism && !/^unknown(?: organism)?$/i.test(String(sourceFeature.organism).trim())
        ? String(sourceFeature.organism).trim()
        : null;
    const proteinSha256 = await this._proteinDigest(annotation);
    const workspaceId = `ws_${await this._hash({ genomePath: genomePath || 'unsaved', assemblyDigest })}`;
    const ref = {
      workspaceId,
      genomeId: `genome_${assemblyDigest}`,
      assemblySha256: assemblyDigest === 'assembly-unavailable' ? null : assemblyDigest,
      annotationRevision: ledger.revision,
      featureId,
      featureHash,
      chromosome,
      annotationId: annotation.id || null,
      locusTag: locusTag || null,
      geneSymbol: geneSymbol || null,
      proteinId: proteinId || null,
      proteinSha256,
      coordinates: {
        start: annotation.start,
        end: annotation.end,
        strand: annotation.strand,
      },
      featureType: annotation.type || null,
      organism,
      taxonId: taxonXref ? taxonXref.split(':')[1] : null,
    };
    this._assertWorkspace(workspace);
    return ref;
  }

  _findFeatureById(featureId, workspace) {
    this._assertWorkspace(workspace);
    if (!workspace.annotations) return null;
    for (const [chromosome, annotations] of Object.entries(workspace.annotations)) {
      for (const annotation of annotations || []) {
        // Stable IDs are derived identically in _featureRef.  The comparison
        // below is resolved asynchronously by _findFeatureByRef instead.
        if (annotation.codexomicsFeatureId === featureId) return { chromosome, annotation };
      }
    }
    return null;
  }

  async _findFeatureByRef(target, workspace) {
    this._assertWorkspace(workspace);
    if (!workspace.annotations) return null;
    const candidates = target.chromosome
      ? [[target.chromosome, workspace.annotations[target.chromosome] || []]]
      : Object.entries(workspace.annotations);
    for (const [chromosome, annotations] of candidates) {
      for (const annotation of annotations || []) {
        const featureId =
          annotation.codexomicsFeatureId ||
          `feat_${await this._hash(this._stableFeatureIdentity(chromosome, annotation))}`;
        if (featureId !== target.featureId) continue;
        const ref = await this._featureRef(
          chromosome,
          annotation,
          { revision: target.annotationRevision || 0 },
          workspace
        );
        return { chromosome, annotation, ref };
      }
    }
    return this._findFeatureById(target.featureId, workspace);
  }

  _normaliseValues(value) {
    const values = Array.isArray(value) ? value : [value];
    return values
      .filter(item => item !== undefined && item !== null)
      .map(item => String(item).trim())
      .filter(Boolean);
  }

  _currentAnnotationSnapshot(annotation) {
    const qualifiers = this._isPlainRecord(annotation?.qualifiers) ? annotation.qualifiers : {};
    const boundedValues = (names, maximumItems, maximumLength) => {
      const seen = new Set();
      const result = [];
      for (const name of names) {
        const raw = qualifiers[name];
        const values = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
        for (const value of values) {
          if (typeof value !== 'string') continue;
          const normalized = value.trim();
          const key = normalized.toLowerCase();
          if (!normalized || normalized.length > maximumLength || seen.has(key)) continue;
          seen.add(key);
          result.push(normalized);
          if (result.length >= maximumItems) return result;
        }
      }
      return result;
    };
    const product = boundedValues(['product'], 1, 1024)[0];
    return {
      ...(product ? { product } : {}),
      note: boundedValues(['note', 'Note'], 32, 8192),
      EC_number: boundedValues(['EC_number', 'ec_number'], 64, 64),
      go_terms: boundedValues(['go_terms', 'GO_terms', 'goTerms'], 256, 64),
      ko: boundedValues(['ko', 'KO'], 128, 128),
      pathway: boundedValues(['pathway', 'Pathway'], 256, 256),
      db_xref: boundedValues(['db_xref', 'dbXref'], 512, 512),
    };
  }

  _matchingFeatures(identifier, chromosome, workspace) {
    this._assertWorkspace(workspace);
    if (!workspace.annotations) return [];
    const target = String(Array.isArray(identifier) ? identifier[0] : identifier);
    const chromosomes = chromosome ? [chromosome] : Object.keys(workspace.annotations);
    const matches = [];
    for (const chr of chromosomes) {
      for (const annotation of workspace.annotations[chr] || []) {
        const identifiers = this._annotationIdentifiers(annotation);
        if (identifiers.includes(target)) matches.push({ chromosome: chr, annotation });
      }
    }
    return matches;
  }

  _assertProposalTarget(proposalTarget, target, requireComplete = false) {
    if (requireComplete) {
      const required = ['workspaceId', 'genomeId', 'annotationRevision', 'featureId', 'featureHash', 'chromosome'];
      for (const field of required) {
        if (
          proposalTarget?.[field] === undefined ||
          proposalTarget?.[field] === null ||
          proposalTarget?.[field] === ''
        ) {
          throw new Error(`Version 2 annotation proposal target is missing required field "${field}"`);
        }
      }
      for (const field of ['assemblySha256', 'proteinSha256']) {
        if (target[field] && proposalTarget?.[field] === undefined) {
          throw new Error(`Version 2 annotation proposal target is missing required field "${field}"`);
        }
      }
      if (target.coordinates && !proposalTarget?.coordinates) {
        throw new Error('Version 2 annotation proposal target is missing required coordinates');
      }
      for (const field of ['start', 'end', 'strand']) {
        if (target.coordinates?.[field] !== undefined && proposalTarget?.coordinates?.[field] === undefined) {
          throw new Error(`Version 2 annotation proposal target is missing required coordinate "${field}"`);
        }
      }
    }
    if (proposalTarget.annotationRevision !== undefined) {
      const proposedRevision = Number(proposalTarget.annotationRevision);
      const currentRevision = Number(target.annotationRevision);
      if (
        !Number.isInteger(proposedRevision) ||
        proposedRevision < 0 ||
        !Number.isInteger(currentRevision) ||
        proposedRevision > currentRevision
      ) {
        throw new Error('Proposal target annotationRevision is invalid or newer than the current annotation ledger');
      }
      if (
        proposedRevision < currentRevision &&
        (!proposalTarget.featureId ||
          !proposalTarget.featureHash ||
          (target.assemblySha256 && !proposalTarget.assemblySha256))
      ) {
        throw new Error('An older proposal target revision requires exact feature and assembly hash bindings');
      }
    }
    const comparable = [
      'workspaceId',
      'genomeId',
      'featureId',
      'featureHash',
      'chromosome',
      'annotationId',
      'locusTag',
      'geneSymbol',
      'proteinId',
      'featureType',
      'assemblySha256',
      'proteinSha256',
      'organism',
      'taxonId',
    ];
    for (const field of comparable) {
      if (proposalTarget[field] === undefined) continue;
      const proposed = proposalTarget[field] === null ? null : String(proposalTarget[field]);
      const current = target[field] === null || target[field] === undefined ? null : String(target[field]);
      if (proposed !== current) {
        throw new Error(`Proposal target ${field} does not match the selected CodeXomics feature`);
      }
    }
    if (proposalTarget.coordinates) {
      for (const field of ['start', 'end', 'strand']) {
        if (proposalTarget.coordinates[field] === undefined) continue;
        if (String(proposalTarget.coordinates[field]) !== String(target.coordinates?.[field])) {
          throw new Error(`Proposal target coordinate ${field} does not match the selected CodeXomics feature`);
        }
      }
    }
  }

  async _validateResearchSummary(summary, evidenceRecords) {
    if (summary === undefined || summary === null) return null;
    if (!this._isPlainRecord(summary) || summary.schema !== 'dgr.curation-summary.v1') {
      throw new Error('annotationProposal.researchSummary must use dgr.curation-summary.v1');
    }
    this._assertBoundedScalar(summary.headline, 'Research summary headline', this.inputLimits.textLength, {
      required: true,
    });
    if (!Array.isArray(summary.facts) || summary.facts.length > 100) {
      throw new Error('Research summary facts must be an array of at most 100 facts');
    }
    if (!Array.isArray(summary.literature) || summary.literature.length > 30) {
      throw new Error('Research summary literature must be an array of at most 30 records');
    }
    if (!Array.isArray(summary.limitations) || summary.limitations.length > 30) {
      throw new Error('Research summary limitations must be an array of at most 30 statements');
    }
    this._assertBoundedValues(summary.limitations, 'Research summary limitations', 30, this.inputLimits.textLength);
    const recordsById = new Map(evidenceRecords.map(record => [String(record.id), record]));
    const isExactPubMedUrl = (value, pmid) => {
      try {
        const url = new URL(String(value));
        return (
          url.protocol === 'https:' &&
          url.hostname.toLowerCase() === 'pubmed.ncbi.nlm.nih.gov' &&
          url.pathname.split('/').filter(Boolean)[0] === String(pmid)
        );
      } catch {
        return false;
      }
    };
    const categories = new Set([
      'identity',
      'function',
      'protein',
      'structure',
      'pathway',
      'localization',
      'regulation',
      'expression',
      'interaction',
      'phenotype',
      'evolution',
      'cross_reference',
    ]);
    const factIds = new Set();
    for (const fact of summary.facts) {
      if (!this._isPlainRecord(fact) || !fact.id || factIds.has(fact.id)) {
        throw new Error(`Research summary contains an invalid or duplicate fact id: ${fact?.id || 'missing'}`);
      }
      factIds.add(fact.id);
      this._assertBoundedScalar(fact.id, 'Research fact id', this.inputLimits.identifierLength, { required: true });
      this._assertBoundedScalar(fact.field, `Research fact ${fact.id} field`, this.inputLimits.identifierLength, {
        required: true,
      });
      this._assertBoundedScalar(fact.statement, `Research fact ${fact.id} statement`, this.inputLimits.textLength, {
        required: true,
      });
      this._assertBoundedValues(
        fact.value,
        `Research fact ${fact.id} value`,
        this.inputLimits.valuesPerField,
        this.inputLimits.textLength
      );
      if (!categories.has(fact.category) || fact.directness !== 'exact_target') {
        throw new Error(`Research fact ${fact.id} is not classified as exact-target evidence`);
      }
      if (!['reviewed_database', 'authoritative_database', 'target_literature'].includes(fact.evidenceLevel)) {
        throw new Error(`Research fact ${fact.id} has an unsupported evidence level`);
      }
      if (
        !Array.isArray(fact.evidenceIds) ||
        fact.evidenceIds.length === 0 ||
        fact.evidenceIds.length > this.inputLimits.referencesPerOperation ||
        fact.evidenceIds.some(id => !recordsById.has(String(id)))
      ) {
        throw new Error(`Research fact ${fact.id} requires evidence present in the proposal manifest`);
      }
      this._assertBoundedValues(
        fact.sourceDatabases,
        `Research fact ${fact.id} source databases`,
        20,
        this.inputLimits.identifierLength
      );
      if (
        fact.confidence !== null &&
        fact.confidence !== undefined &&
        (!Number.isFinite(Number(fact.confidence)) || Number(fact.confidence) < 0 || Number(fact.confidence) > 1)
      ) {
        throw new Error(`Research fact ${fact.id} confidence must be between 0 and 1`);
      }
      if (fact.evidenceLevel === 'target_literature') {
        if (fact.confidence !== null || fact.evidenceIds.length !== 1) {
          throw new Error(
            `Research literature fact ${fact.id} must use null confidence and exactly one evidence record`
          );
        }
        const basis = fact.literatureBasis;
        const citation = fact.citation;
        if (
          !this._isPlainRecord(basis) ||
          basis.kind !== 'pubmed_abstract_span' ||
          !this._isPlainRecord(citation) ||
          citation.type !== 'pmid'
        ) {
          throw new Error(`Research literature fact ${fact.id} requires a PubMed abstract basis and citation`);
        }
        this._assertBoundedScalar(
          basis.pmid,
          `Research literature fact ${fact.id} PMID`,
          this.inputLimits.identifierLength,
          {
            required: true,
          }
        );
        this._assertBoundedScalar(
          basis.doi,
          `Research literature fact ${fact.id} DOI`,
          this.inputLimits.referenceLength
        );
        this._assertBoundedScalar(
          basis.excerpt,
          `Research literature fact ${fact.id} excerpt`,
          this.inputLimits.textLength,
          {
            required: true,
          }
        );
        this._assertBoundedScalar(
          basis.excerptSha256,
          `Research literature fact ${fact.id} excerpt hash`,
          this.inputLimits.identifierLength,
          { required: true }
        );
        for (const field of ['evidenceId', 'abstractSha256', 'hashEncoding', 'canonicalization', 'offsetEncoding']) {
          this._assertBoundedScalar(
            basis[field],
            `Research literature fact ${fact.id} ${field}`,
            this.inputLimits.identifierLength,
            { required: true }
          );
        }
        if (
          !this._isValidPmid(basis.pmid) ||
          !/^[a-f0-9]{64}$/i.test(String(basis.excerptSha256)) ||
          !/^[a-f0-9]{64}$/i.test(String(basis.abstractSha256)) ||
          basis.hashEncoding !== 'utf8' ||
          basis.canonicalization !== 'dgr.pubmed-abstract.v1' ||
          basis.offsetEncoding !== 'utf16_code_units' ||
          !Number.isSafeInteger(basis.excerptStart) ||
          !Number.isSafeInteger(basis.excerptEnd) ||
          !Number.isSafeInteger(basis.abstractLength) ||
          basis.excerptStart < 0 ||
          basis.excerptEnd <= basis.excerptStart ||
          basis.excerptEnd > basis.abstractLength ||
          basis.excerptEnd - basis.excerptStart !== String(basis.excerpt).length
        ) {
          throw new Error(`Research literature fact ${fact.id} has an invalid PMID or excerpt hash`);
        }
        if (basis.doi && !/^10\.\d{4,9}\/.+/i.test(String(basis.doi))) {
          throw new Error(`Research literature fact ${fact.id} has an invalid DOI`);
        }
        if (String(fact.statement) !== String(basis.excerpt)) {
          throw new Error(
            `Research literature fact ${fact.id} statement must equal its authenticated abstract excerpt`
          );
        }
        const computedExcerptHash = await this._hashSerialized(String(basis.excerpt), { requireSha256: true });
        if (computedExcerptHash !== String(basis.excerptSha256).toLowerCase()) {
          throw new Error(`Research literature fact ${fact.id} excerpt hash does not match its excerpt`);
        }
        for (const field of ['id', 'label', 'url', 'title']) {
          this._assertBoundedScalar(
            citation[field],
            `Research literature fact ${fact.id} citation ${field}`,
            this.inputLimits.referenceLength,
            { required: true }
          );
        }
        this._assertBoundedScalar(
          citation.doi,
          `Research literature fact ${fact.id} citation DOI`,
          this.inputLimits.referenceLength
        );
        if (
          String(citation.id) !== String(basis.pmid) ||
          String(citation.label) !== `PMID:${basis.pmid}` ||
          !isExactPubMedUrl(citation.url, basis.pmid) ||
          (basis.doi && String(citation.doi || '').toLowerCase() !== String(basis.doi).toLowerCase())
        ) {
          throw new Error(`Research literature fact ${fact.id} citation does not match its PubMed basis`);
        }
        const record = recordsById.get(String(fact.evidenceIds[0]));
        const identifiers = Array.isArray(record?.identifiers) ? record.identifiers : [];
        const hasIdentifier = (scheme, value) =>
          identifiers.some(
            identifier =>
              identifier?.scheme === scheme && String(identifier.value).toLowerCase() === String(value).toLowerCase()
          );
        const binding = record?.sourceBinding;
        if (
          String(basis.evidenceId) !== String(record?.id || '') ||
          binding?.schema !== 'dgr.evidence-source-binding.v1' ||
          binding.sourceCollection !== 'sources' ||
          binding.selector?.database !== 'pubmed' ||
          binding.selector?.identifier?.scheme !== 'pmid' ||
          String(binding.selector?.identifier?.value || '') !== String(basis.pmid) ||
          binding.content?.relativeJsonPointer !== '/structuredData/literatureReferences/0/abstract' ||
          binding.content?.canonicalization !== 'dgr.pubmed-abstract.v1' ||
          binding.content?.hashEncoding !== 'utf8' ||
          binding.content?.lengthEncoding !== 'utf16_code_units' ||
          String(binding.content?.sha256 || '').toLowerCase() !== String(basis.abstractSha256).toLowerCase() ||
          binding.content?.length !== basis.abstractLength ||
          typeof record?.supporting !== 'boolean' ||
          record?.type !== 'pmid' ||
          String(record?.database || '').toLowerCase() !== 'pubmed' ||
          !hasIdentifier('pmid', basis.pmid) ||
          (basis.doi && !hasIdentifier('doi', basis.doi))
        ) {
          throw new Error(
            `Research literature fact ${fact.id} is not exactly bound to its non-mutating PubMed evidence`
          );
        }
      }
    }
    for (const literature of summary.literature) {
      if (!this._isPlainRecord(literature)) throw new Error('Research literature entries must be JSON objects');
      this._assertBoundedScalar(literature.title, 'Research literature title', this.inputLimits.referenceLength, {
        required: true,
      });
      this._assertBoundedScalar(literature.url, 'Research literature URL', this.inputLimits.referenceLength, {
        required: true,
      });
      this._assertBoundedScalar(
        literature.relevanceReason,
        'Research literature relevance reason',
        this.inputLimits.textLength,
        { required: true }
      );
      this._assertBoundedScalar(literature.pmid, 'Research literature PMID', this.inputLimits.identifierLength);
      this._assertBoundedScalar(literature.doi, 'Research literature DOI', this.inputLimits.referenceLength);
      if (!/^https?:\/\//i.test(String(literature.url)) || !['high', 'medium'].includes(literature.relevance)) {
        throw new Error('Research literature entries require an HTTP(S) URL and a supported relevance level');
      }
      if (literature.pmid && !this._isValidPmid(literature.pmid)) {
        throw new Error(`Research literature entry has an invalid PMID: ${literature.pmid}`);
      }
      if (literature.pmid && !isExactPubMedUrl(literature.url, literature.pmid)) {
        throw new Error(`Research literature PMID ${literature.pmid} does not match its PubMed URL`);
      }
      if (literature.doi && !/^10\.\d{4,9}\/.+/i.test(String(literature.doi))) {
        throw new Error(`Research literature entry has an invalid DOI: ${literature.doi}`);
      }
      if (
        !Array.isArray(literature.evidenceIds) ||
        literature.evidenceIds.length === 0 ||
        literature.evidenceIds.some(id => !recordsById.has(String(id)))
      ) {
        throw new Error('Research literature entry requires evidence present in the proposal manifest');
      }
      const referencedRecords = literature.evidenceIds.map(id => recordsById.get(String(id)));
      const hasExactIdentifier = (scheme, value) =>
        referencedRecords.some(
          record =>
            Array.isArray(record?.identifiers) &&
            record.identifiers.some(
              identifier =>
                identifier?.scheme === scheme && String(identifier.value).toLowerCase() === String(value).toLowerCase()
            )
        );
      if (literature.pmid && !hasExactIdentifier('pmid', literature.pmid)) {
        throw new Error(`Research literature PMID ${literature.pmid} is not bound to its evidence record`);
      }
      if (literature.doi && !hasExactIdentifier('doi', literature.doi)) {
        throw new Error(`Research literature DOI ${literature.doi} is not bound to its evidence record`);
      }
    }
    this._assertSerializableSize(summary, 'Annotation research summary');
    return this._clone(summary);
  }

  _curationNoteSentence(statement) {
    const compact = String(statement || '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!compact) return '';
    const sentence = compact.charAt(0).toUpperCase() + compact.slice(1);
    return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
  }

  async _validateCurationNote(note, researchSummary, evidenceRecords, claims, operations) {
    if (note === undefined || note === null) return null;
    if (!researchSummary || !this._isPlainRecord(note) || note.schema !== 'dgr.curation-note.v1') {
      throw new Error('annotationProposal.curationNote requires dgr.curation-note.v1 and a validated research summary');
    }
    const text = this._assertBoundedScalar(note.text, 'Curation note text', this.inputLimits.textLength, {
      required: true,
    });
    if (!/^[a-f0-9]{64}$/i.test(String(note.textSha256 || ''))) {
      throw new Error('Curation note requires a SHA-256 text hash');
    }
    const computedHash = await this._hashSerialized(text, { requireSha256: true });
    if (computedHash !== String(note.textSha256).toLowerCase()) {
      throw new Error('Curation note text hash does not match its text');
    }
    if (!Array.isArray(note.segments) || note.segments.length === 0 || note.segments.length > 30) {
      throw new Error('Curation note requires between 1 and 30 evidence-bound segments');
    }
    const factsById = new Map(researchSummary.facts.map(fact => [String(fact.id), fact]));
    const recordsById = new Map(evidenceRecords.map(record => [String(record.id), record]));
    const includedFactIds = [];
    const includedEvidenceIds = [];
    let literatureSegmentCount = 0;
    for (const segment of note.segments) {
      if (!this._isPlainRecord(segment)) throw new Error('Curation note segments must be JSON objects');
      this._assertBoundedScalar(segment.text, 'Curation note segment text', this.inputLimits.textLength, {
        required: true,
      });
      this._assertBoundedScalar(segment.category, 'Curation note segment category', this.inputLimits.identifierLength, {
        required: true,
      });
      if (!Array.isArray(segment.factIds) || segment.factIds.length !== 1) {
        throw new Error('Every curation note segment must bind exactly one research fact');
      }
      const fact = factsById.get(String(segment.factIds[0]));
      if (!fact || segment.category !== fact.category) {
        throw new Error('Curation note segment does not match its research fact category');
      }
      if (
        !Array.isArray(segment.evidenceIds) ||
        !this._canonicalValuesEqual(segment.evidenceIds, fact.evidenceIds) ||
        segment.evidenceIds.some(id => !recordsById.has(String(id)))
      ) {
        throw new Error('Curation note segment is not bound to its research fact evidence');
      }
      if (!Array.isArray(segment.citations) || segment.citations.length > 10) {
        throw new Error('Curation note segment citations must be a bounded array');
      }
      const expectedSentence = this._curationNoteSentence(fact.statement);
      if (fact.evidenceLevel === 'target_literature') {
        const citation = fact.citation;
        if (
          !citation ||
          segment.citations.length !== 1 ||
          segment.citations[0]?.type !== 'pmid' ||
          String(segment.citations[0]?.id || '') !== String(citation.id) ||
          String(segment.citations[0]?.label || '') !== String(citation.label) ||
          String(segment.citations[0]?.url || '') !== String(citation.url) ||
          segment.text !== `${expectedSentence} (PMID:${citation.id}).`
        ) {
          throw new Error('Curation note literature segment is not the exact citation-bound research fact');
        }
        literatureSegmentCount += 1;
      } else if (segment.citations.length !== 0 || segment.text !== expectedSentence) {
        throw new Error('Curation note authoritative segment is not the exact database fact');
      }
      includedFactIds.push(String(fact.id));
      includedEvidenceIds.push(...segment.evidenceIds.map(String));
    }
    if (literatureSegmentCount === 0 || note.segments.map(segment => segment.text).join(' ') !== text) {
      throw new Error('Curation note must include citation-bound literature and exactly match its segments');
    }
    const dedupe = values => Array.from(new Set(values));
    const factIds = dedupe(includedFactIds);
    const evidenceIds = dedupe(includedEvidenceIds);
    if (
      !this._canonicalValuesEqual(note.factIds, factIds) ||
      !this._canonicalValuesEqual(note.evidenceIds, evidenceIds)
    ) {
      throw new Error('Curation note aggregate bindings do not match its segments');
    }
    if (!this._isPlainRecord(note.coverage)) throw new Error('Curation note requires coverage metadata');
    const omittedFactIds = Array.isArray(note.coverage.omittedFactIds)
      ? note.coverage.omittedFactIds.map(String)
      : null;
    if (
      !omittedFactIds ||
      omittedFactIds.some(id => !factsById.has(id) || factIds.includes(id)) ||
      note.coverage.includedFactCount !== factIds.length ||
      note.coverage.availableFactCount !== factIds.length + omittedFactIds.length ||
      !Array.isArray(note.coverage.includedCategories) ||
      !this._canonicalValuesEqual(
        note.coverage.includedCategories,
        dedupe(note.segments.map(segment => segment.category))
      )
    ) {
      throw new Error('Curation note coverage metadata is inconsistent');
    }
    const noteClaims = claims.filter(claim => claim.field === 'note' && String(claim.value) === text);
    const noteOperations = operations.filter(
      operation => operation.op === 'addQualifier' && operation.field === 'note' && String(operation.value) === text
    );
    if (
      noteClaims.length !== 1 ||
      noteOperations.length !== 1 ||
      !this._canonicalValuesEqual(noteClaims[0].evidenceIds, evidenceIds) ||
      !this._canonicalValuesEqual(noteOperations[0].claimIds, [noteClaims[0].id]) ||
      evidenceIds.some(id => recordsById.get(id)?.supporting !== true)
    ) {
      throw new Error('Curation note is not bound to one evidence-supported note operation');
    }
    this._assertSerializableSize(note, 'Curation note');
    return this._clone(note);
  }

  async _validateV2Proposal(proposal, target) {
    if (!proposal.schema) return null;
    if (proposal.schema !== 'codexomics.annotation-change-set.v2') {
      throw new Error(`Unsupported annotation proposal schema: ${proposal.schema}`);
    }
    if (proposal.status !== 'ready_for_validation') {
      throw new Error('Version 2 annotation proposal is not ready for validation and must be bound to an exact target');
    }
    this._assertProposalTarget(proposal.target, target, true);
    const proposalBaseRevision = Number(proposal.baseRevision ?? proposal.target.annotationRevision);
    if (
      !Number.isInteger(proposalBaseRevision) ||
      proposalBaseRevision < 0 ||
      proposalBaseRevision !== Number(proposal.target.annotationRevision) ||
      proposalBaseRevision > target.annotationRevision
    ) {
      throw new Error('Proposal base revision must match its target revision and cannot be newer than the ledger');
    }

    const manifest = proposal.evidenceManifest;
    if (manifest?.schema !== 'dgr.evidence-manifest.v1' || !Array.isArray(manifest.sourceRecords)) {
      throw new Error('Version 2 annotation proposal requires a dgr.evidence-manifest.v1 evidence manifest');
    }
    if (manifest.sourceRecords.length > this.inputLimits.evidenceRecords) {
      throw new Error(`Evidence manifest exceeds the maximum of ${this.inputLimits.evidenceRecords} records`);
    }
    this._assertBoundedScalar(manifest.generatedAt, 'Evidence manifest generatedAt', this.inputLimits.identifierLength);
    this._assertBoundedScalar(
      manifest.pipelineVersion,
      'Evidence manifest pipelineVersion',
      this.inputLimits.identifierLength
    );
    const evidenceIds = new Set();
    const supportingEvidenceIds = new Set();
    const allowedEvidenceTypes = new Set(['pmid', 'doi', 'url', 'database', 'citation']);
    for (const record of manifest.sourceRecords) {
      if (!record?.id || !record?.label || !record?.sourceHash) {
        throw new Error('Every evidence record requires an id, label, and sourceHash');
      }
      if (!this._isPlainRecord(record)) throw new Error('Every evidence record must be a JSON object');
      this._assertBoundedScalar(record.id, 'Evidence record id', this.inputLimits.identifierLength, {
        required: true,
      });
      this._assertBoundedScalar(record.label, `Evidence record ${record.id} label`, this.inputLimits.referenceLength, {
        required: true,
      });
      for (const field of ['sourceId', 'url', 'database']) {
        this._assertBoundedScalar(
          record[field],
          `Evidence record ${record.id} ${field}`,
          this.inputLimits.referenceLength
        );
      }
      if (record.identifiers !== undefined) {
        if (!Array.isArray(record.identifiers) || record.identifiers.length === 0 || record.identifiers.length > 10) {
          throw new Error(`Evidence record ${record.id} identifiers must contain between 1 and 10 entries`);
        }
        const identifierKeys = new Set();
        for (const identifier of record.identifiers) {
          if (!this._isPlainRecord(identifier) || !['pmid', 'doi'].includes(identifier.scheme)) {
            throw new Error(`Evidence record ${record.id} contains an unsupported structured identifier`);
          }
          this._assertBoundedScalar(
            identifier.value,
            `Evidence record ${record.id} identifier`,
            this.inputLimits.referenceLength,
            { required: true }
          );
          if (identifier.scheme === 'pmid' && !this._isValidPmid(identifier.value)) {
            throw new Error(`Evidence record ${record.id} contains an invalid PMID identifier`);
          }
          if (identifier.scheme === 'doi' && !/^10\.\d{4,9}\/.+/i.test(String(identifier.value))) {
            throw new Error(`Evidence record ${record.id} contains an invalid DOI identifier`);
          }
          const key = `${identifier.scheme}:${String(identifier.value).toLowerCase()}`;
          if (identifierKeys.has(key)) throw new Error(`Evidence record ${record.id} contains duplicate identifiers`);
          identifierKeys.add(key);
        }
      }
      if (record.sourceBinding !== undefined) {
        const binding = record.sourceBinding;
        if (
          !this._isPlainRecord(binding) ||
          binding.schema !== 'dgr.evidence-source-binding.v1' ||
          binding.sourceCollection !== 'sources' ||
          binding.selector?.database !== 'pubmed' ||
          binding.selector?.identifier?.scheme !== 'pmid' ||
          !this._isValidPmid(binding.selector?.identifier?.value) ||
          binding.content?.relativeJsonPointer !== '/structuredData/literatureReferences/0/abstract' ||
          binding.content?.canonicalization !== 'dgr.pubmed-abstract.v1' ||
          !/^[a-f0-9]{64}$/i.test(String(binding.content?.sha256 || '')) ||
          binding.content?.hashEncoding !== 'utf8' ||
          !Number.isSafeInteger(binding.content?.length) ||
          binding.content.length < 1 ||
          binding.content?.lengthEncoding !== 'utf16_code_units'
        ) {
          throw new Error(`Evidence record ${record.id} has an invalid archived-source binding`);
        }
      }
      if (!allowedEvidenceTypes.has(record.type)) throw new Error(`Unsupported evidence record type: ${record.type}`);
      if (!/^[a-f0-9]{64}$/i.test(record.sourceHash)) {
        throw new Error(`Evidence record ${record.id} requires a SHA-256 sourceHash`);
      }
      if (!record.retrievedAt || !Number.isFinite(Date.parse(record.retrievedAt))) {
        throw new Error(`Evidence record ${record.id} requires a valid retrievedAt timestamp`);
      }
      if (typeof record.supporting !== 'boolean') {
        throw new Error(`Evidence record ${record.id} requires an explicit supporting flag`);
      }
      if (evidenceIds.has(record.id)) throw new Error(`Duplicate evidence record id: ${record.id}`);
      evidenceIds.add(record.id);
      if (record.supporting) supportingEvidenceIds.add(record.id);
    }

    if (!Array.isArray(proposal.claims) || !Array.isArray(proposal.operations)) {
      throw new Error('Version 2 annotation proposal requires claims and operations arrays');
    }
    if (proposal.claims.length > this.inputLimits.claims) {
      throw new Error(`Version 2 annotation proposal exceeds the maximum of ${this.inputLimits.claims} claims`);
    }
    this._validateOperationPayloads(proposal.operations, 'annotationProposal.operations');
    const claims = new Map();
    for (const claim of proposal.claims) {
      if (!this._isPlainRecord(claim)) throw new Error('Every annotation claim must be a JSON object');
      if (!claim?.id || claims.has(claim.id)) {
        throw new Error(`Invalid or duplicate claim id: ${claim?.id || 'missing'}`);
      }
      this._assertBoundedScalar(claim.id, 'Annotation claim id', this.inputLimits.identifierLength, {
        required: true,
      });
      this._assertBoundedScalar(claim.field, `Claim ${claim.id} field`, this.inputLimits.identifierLength, {
        required: true,
      });
      this._assertBoundedValues(
        claim.value,
        `Claim ${claim.id} value`,
        this.inputLimits.valuesPerField,
        this.inputLimits.textLength
      );
      if (!claim.field || !this.allowedQualifierFields.has(claim.field)) {
        throw new Error(`Claim ${claim.id} uses unsupported annotation field "${claim.field || 'missing'}"`);
      }
      if (
        !Array.isArray(claim.evidenceIds) ||
        claim.evidenceIds.length === 0 ||
        claim.evidenceIds.length > this.inputLimits.referencesPerOperation ||
        claim.evidenceIds.some(id => !evidenceIds.has(id))
      ) {
        throw new Error(`Claim ${claim.id} requires evidence present in the evidence manifest`);
      }
      if (claim.evidenceIds.some(id => !supportingEvidenceIds.has(id))) {
        throw new Error(`Claim ${claim.id} references evidence that is not marked as supporting`);
      }
      if (
        claim.confidence !== null &&
        claim.confidence !== undefined &&
        (!Number.isFinite(Number(claim.confidence)) || Number(claim.confidence) < 0 || Number(claim.confidence) > 1)
      ) {
        throw new Error(`Claim ${claim.id} confidence must be between 0 and 1`);
      }
      claims.set(claim.id, claim);
    }
    const referencedClaims = new Set();
    for (const operation of proposal.operations) {
      if (!Array.isArray(operation.claimIds) || operation.claimIds.length === 0) {
        throw new Error('Every version 2 proposal operation must reference at least one claimId');
      }
      const field =
        operation.op === 'addDbxref'
          ? 'db_xref'
          : operation.op === 'addEvidenceLink'
            ? 'codexomics_research_evidence'
            : operation.field;
      const supportedValues = [];
      for (const claimId of operation.claimIds) {
        const claim = claims.get(claimId);
        if (!claim) throw new Error(`Operation references unknown claimId: ${claimId}`);
        if (claim.field !== field) {
          throw new Error(`Operation field ${field} is not supported by referenced claim ${claimId}`);
        }
        referencedClaims.add(claimId);
        supportedValues.push(...this._normaliseValues(claim.value));
      }
      const operationValues = this._normaliseValues(operation.value);
      if (operation.op !== 'removeQualifier' && operationValues.some(value => !supportedValues.includes(value))) {
        throw new Error(`Operation value for ${field} is not supported by its referenced claims`);
      }
    }
    if (referencedClaims.size !== claims.size) {
      throw new Error('Version 2 annotation proposal contains claims that are not bound to an operation');
    }
    const researchSummary = await this._validateResearchSummary(proposal.researchSummary, manifest.sourceRecords);
    const curationNote = await this._validateCurationNote(
      proposal.curationNote,
      researchSummary,
      manifest.sourceRecords,
      proposal.claims,
      proposal.operations
    );
    return {
      evidenceManifest: this._clone(manifest),
      claims: this._clone(proposal.claims),
      proposalMetadata: {
        summary: proposal.summary || null,
        confidence: proposal.confidence ?? null,
        reportUrl: proposal.reportUrl || null,
        detailsUrl: proposal.detailsUrl || null,
        generatedAt: proposal.generatedAt || null,
        researchSummary,
        curationNote,
      },
      proposalBaseRevision,
    };
  }

  async _requireArchivedDgrReport(proposal, target, researchRun) {
    if (proposal?.researchSummary?.schema !== 'dgr.curation-summary.v1') return null;
    const taskId = String(researchRun || '').trim();
    if (!taskId || taskId.length > 256 || !/^[A-Za-z0-9._:-]+$/.test(taskId)) {
      throw new Error('A DGR curation proposal requires its archived researchRun task ID');
    }
    const attachments = this.app?.geneAttachmentsManager;
    if (attachments?.ready) await attachments.ready;
    if (!attachments || typeof attachments.getAttachmentsForGene !== 'function') {
      throw new Error('A DGR curation proposal requires the genome-scoped report attachment store');
    }
    const geneId = String(target.locusTag || target.geneSymbol || target.proteinId || target.featureId);
    const attachment = attachments
      .getAttachmentsForGene(geneId)
      .find(item => item?.id === `dgr:${taskId}` && item?.kind === 'dgr-research-report');
    if (!attachment) {
      throw new Error(`Archive DGR research task ${taskId} as a gene report before creating its ChangeSet`);
    }
    for (const field of ['workspaceId', 'genomeId', 'annotationRevision', 'featureId', 'featureHash', 'chromosome']) {
      if (String(attachment.target?.[field] ?? '') !== String(target[field] ?? '')) {
        throw new Error(`Archived DGR report ${taskId} ${field} does not match the selected CDS target`);
      }
    }
    if (
      attachment.citationValidation?.schema !== 'codexomics.dgr-citation-validation.v1' ||
      attachment.citationValidation.verified !== true
    ) {
      throw new Error(`Archived DGR report ${taskId} has not passed citation-to-abstract validation`);
    }
    const currentAnnotationValidation = attachment.currentAnnotationValidation;
    if (
      currentAnnotationValidation?.schema !== 'codexomics.dgr-current-annotation-validation.v1' ||
      currentAnnotationValidation.verified !== true ||
      !/^[a-f0-9]{64}$/i.test(String(currentAnnotationValidation.snapshotSha256 || '')) ||
      String(currentAnnotationValidation.targetFeatureHash || '') !== String(target.featureHash || '')
    ) {
      throw new Error(`Archived DGR report ${taskId} has not passed current-annotation snapshot validation`);
    }
    const proposalHash = await this._hash(proposal);
    if (
      !/^[a-f0-9]{64}$/i.test(String(attachment.proposalSha256 || '')) ||
      proposalHash !== attachment.proposalSha256
    ) {
      throw new Error(`Archived DGR report ${taskId} does not contain this exact annotation proposal`);
    }
    return {
      attachmentId: attachment.id,
      taskId,
      sha256: attachment.sha256,
      proposalSha256: attachment.proposalSha256,
      citationValidation: this._clone(attachment.citationValidation),
      currentAnnotationValidation: this._clone(currentAnnotationValidation),
    };
  }

  _isPlaceholderProduct(product) {
    return (
      !product || /^(unknown|hypothetical|uncharacteri[sz]ed|putative protein|predicted protein)/i.test(String(product))
    );
  }

  _executionContext(params) {
    const context = params?.__executionContext;
    return context && typeof context === 'object' ? context : null;
  }

  _hasPermission(context, permission) {
    if (!context?.authenticated) return false;
    const permissions = Array.isArray(context.permissions) ? context.permissions : [];
    return context.isAdmin === true || permissions.includes('*') || permissions.includes(permission);
  }

  _principal(params, fallback) {
    const context = this._executionContext(params);
    if (context?.authenticated && context.principal) return String(context.principal);
    return String(params?.principal || params?.agent || fallback);
  }

  _requirePermission(params, permission) {
    const context = this._executionContext(params);
    if (!this._hasPermission(context, permission)) {
      throw new Error(`Authenticated curator permission "${permission}" is required`);
    }
    return context;
  }

  _requirePermissionWhenExternal(params, permission) {
    const context = this._executionContext(params);
    if (context && !this._hasPermission(context, permission)) {
      throw new Error(`Authenticated MCP permission "${permission}" is required`);
    }
    return context;
  }

  _validatedExternalCurator(params, permission) {
    const context = this._executionContext(params);
    if (!context) return null;
    if (!this._hasPermission(context, permission)) {
      throw new Error(`Authenticated curator permission "${permission}" is required`);
    }
    const principal = String(context.principal || '').trim();
    if (!principal) throw new Error('Authenticated curator identity is missing');
    return { context, principal };
  }

  _isApprovalBoundToChangeSet(approval, changeSet) {
    return Boolean(
      approval &&
      changeSet?.approvalId &&
      approval.id === changeSet.approvalId &&
      this._isApprovalOwnedByChangeSet(approval, changeSet) &&
      approval.changeSetHash === changeSet.changeSetHash &&
      approval.baseRevision === changeSet.baseRevision
    );
  }

  _isApprovalOwnedByChangeSet(approval, changeSet) {
    return Boolean(approval && changeSet && approval.changeSetId === changeSet.id);
  }

  _assertCommitDeadline(params) {
    const context = this._executionContext(params);
    const commitNotAfter = Number(context?.commitNotAfter ?? context?.requestDeadline);
    if (Number.isFinite(commitNotAfter) && Date.now() >= commitNotAfter) {
      throw new Error('The MCP request deadline elapsed before the durable annotation commit began; retry safely');
    }
  }

  _immutableChangeSetPayload(changeSet) {
    return {
      schema: changeSet.schema,
      hashVersion: changeSet.hashVersion,
      legacyIntegrity: changeSet.legacyIntegrity,
      targetFormat: changeSet.targetFormat,
      id: changeSet.id,
      createdAt: changeSet.createdAt,
      createdBy: changeSet.createdBy,
      idempotencyKey: changeSet.idempotencyKey,
      requestHash: changeSet.requestHash,
      baseRevision: changeSet.baseRevision,
      proposalBaseRevision: changeSet.proposalBaseRevision,
      target: changeSet.target,
      evidence: changeSet.evidence,
      evidenceManifest: changeSet.evidenceManifest,
      claims: changeSet.claims,
      proposalMetadata: changeSet.proposalMetadata,
      researchRun: changeSet.researchRun,
      manifestHash: changeSet.manifestHash,
      operations: changeSet.operations,
      riskLevel: changeSet.riskLevel,
      requiresHumanApproval: changeSet.requiresHumanApproval,
      validation: changeSet.validation,
    };
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

  _operationWouldChange(annotation, operation) {
    const current = this._normaliseValues(annotation?.qualifiers?.[operation.field]);
    if (operation.op === 'removeQualifier') return current.length > 0;
    const incoming = this._normaliseValues(operation.value);
    if (operation.op === 'replaceQualifier') {
      if (current.length !== incoming.length) return true;
      return current.some((value, index) => value.toLowerCase() !== incoming[index]?.toLowerCase());
    }
    const existing = new Set(current.map(value => value.toLowerCase()));
    return incoming.some(value => !existing.has(value.toLowerCase()));
  }

  _proposalToOperations(params) {
    const proposal = params.annotationProposal || params.proposal || {};
    if (proposal.schema === 'codexomics.annotation-change-set.v2') {
      return proposal.operations.map(operation => ({ ...operation }));
    }
    let operations = [];
    if (Array.isArray(params.operations)) {
      operations = params.operations.map(operation => ({ ...operation }));
    } else if (Array.isArray(proposal.operations)) {
      operations = proposal.operations.map(operation => ({ ...operation }));
    } else {
      const updates = proposal.updates || params.updates || {};
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
    }

    const hasField = field => operations.some(operation => operation.field === field);
    if (proposal.summary && !hasField('function_research_summary')) {
      operations.push({
        op: 'addQualifier',
        field: 'function_research_summary',
        value: proposal.summary,
        generatedFromProposalMetadata: true,
      });
    }
    if (proposal.reportUrl && !hasField('codexomics_research_report')) {
      operations.push({
        op: 'addQualifier',
        field: 'codexomics_research_report',
        value: proposal.reportUrl,
        generatedFromProposalMetadata: true,
      });
    }
    if (proposal.detailsUrl && !hasField('codexomics_research_details')) {
      operations.push({
        op: 'addQualifier',
        field: 'codexomics_research_details',
        value: proposal.detailsUrl,
        generatedFromProposalMetadata: true,
      });
    }
    if (
      proposal.confidence !== undefined &&
      proposal.confidence !== null &&
      !hasField('codexomics_research_confidence')
    ) {
      operations.push({
        op: 'addQualifier',
        field: 'codexomics_research_confidence',
        value: String(proposal.confidence),
        generatedFromProposalMetadata: true,
      });
    }
    if (Array.isArray(proposal.evidence) && proposal.evidence.length > 0 && !hasField('codexomics_research_evidence')) {
      operations.push({
        op: 'addEvidenceLink',
        value: proposal.evidence,
        generatedFromProposalMetadata: true,
      });
    }
    return operations;
  }

  async resolveAnnotationTarget(params = {}) {
    this._requirePermissionWhenExternal(params, 'annotation:read');
    return this._withLedgerLock(async workspace => {
      const ledger = await this._loadLedger(workspace);
      return this._resolveAnnotationTarget(params, ledger, workspace);
    });
  }

  async restoreCommittedAnnotationOverlay() {
    return this._withLedgerLock(async workspace => {
      const ledger = await this._loadLedger(workspace);
      const restored = Object.values(ledger.changeSets).filter(
        changeSet => changeSet?.status === 'committed' && changeSet.commitReceipt
      ).length;
      return { success: true, revision: ledger.revision, committedChangeSets: restored };
    });
  }

  async _resolveAnnotationTarget(params, ledger, workspace) {
    const identifier = params.identifier || params.annotationId || params.gene || params.geneSymbol || params.locusTag;
    const chromosome = params.chromosome || params.chrom || params.chr || null;
    if (!identifier) throw new Error('resolve_annotation_target requires an identifier');
    let matches = this._matchingFeatures(identifier, chromosome, workspace);
    if (matches.length === 0) {
      throw new Error(`Annotation "${identifier}" not found${chromosome ? ` on chromosome "${chromosome}"` : ''}`);
    }
    // GenBank commonly stores a gene feature and its CDS with the same
    // locus_tag. Annotation research and qualifier updates must target the
    // CDS, because that is where product/function qualifiers live. Prefer a
    // single CDS only when the duplicate is the gene/CDS pair on one
    // replicon; retain the ambiguity error for multiple CDS copies or
    // cross-replicon matches.
    if (matches.length > 1) {
      const cdsMatches = matches.filter(match => String(match.annotation?.type || '').toUpperCase() === 'CDS');
      const chromosomes = new Set(matches.map(match => match.chromosome));
      if (cdsMatches.length === 1 && chromosomes.size === 1) matches = cdsMatches;
    }
    if (matches.length > 1) {
      const locations = matches.map(match => match.chromosome).join(', ');
      throw new Error(
        `Annotation identifier "${identifier}" is ambiguous (${matches.length} matches on: ${locations}); specify chromosome and a unique feature identifier`
      );
    }
    const found = matches[0];
    return {
      success: true,
      target: await this._featureRef(found.chromosome, found.annotation, ledger, workspace),
      annotation: {
        id: found.annotation.id || null,
        qualifiers: this._clone(found.annotation.qualifiers || {}),
      },
      currentAnnotation: this._currentAnnotationSnapshot(found.annotation),
    };
  }

  async createAnnotationChangeset(params = {}) {
    this._requirePermissionWhenExternal(params, 'annotation:propose');
    return this._withLedgerLock(workspace => this._createAnnotationChangeset(params, workspace));
  }

  _requestIdentityPayload(params) {
    return {
      identifier:
        params.identifier || params.annotationId || params.gene || params.geneSymbol || params.locusTag || null,
      chromosome: params.chromosome || params.chrom || params.chr || null,
      baseRevision: params.baseRevision ?? null,
      operations: params.operations || null,
      annotationProposal: params.annotationProposal || params.proposal || null,
      updates: params.updates || null,
      evidence: params.evidence || null,
      researchRun: params.researchRun || params.researchRunId || null,
      manifestHash: params.manifestHash || null,
      principal: this._principal(params, 'unknown-agent'),
    };
  }

  async _createAnnotationChangeset(params = {}, workspace) {
    const ledger = await this._loadLedger(workspace);
    const idempotencyKey = params.idempotencyKey || this._id('idem');
    const requestIdentityPayload = this._requestIdentityPayload(params);
    this._validateRequestPayloadBounds(params, requestIdentityPayload);
    const requestHash = await this._hash(requestIdentityPayload);
    const idempotencyRecord = this._ledgerMapGet(ledger.idempotencyKeys, idempotencyKey);
    if (idempotencyRecord) {
      if (idempotencyRecord.legacyAmbiguous === true) {
        const ownerIds = Array.isArray(idempotencyRecord.ownerIds)
          ? idempotencyRecord.ownerIds.join(', ')
          : 'unknown legacy owners';
        throw new Error(
          `Idempotency key "${idempotencyKey}" is an ambiguous migrated legacy key owned by ${ownerIds}; inspect those ChangeSets by ID or use a new key`
        );
      }
      if (idempotencyRecord.legacyOpaque === true) {
        throw new Error(
          `Idempotency key "${idempotencyKey}" belongs to a migrated legacy request whose original request identity is unavailable; inspect that ChangeSet by ID or use a new key`
        );
      }
      const existingId =
        typeof idempotencyRecord === 'string'
          ? idempotencyRecord
          : idempotencyRecord.changeSetId || idempotencyRecord.id;
      const existing = this._ledgerMapGet(ledger.changeSets, existingId);
      if (!existing) throw new Error(`Idempotency ledger for "${idempotencyKey}" references a missing ChangeSet`);
      const existingRequestHash = idempotencyRecord.requestHash || existing.requestHash;
      if (existingRequestHash && existingRequestHash !== requestHash) {
        throw new Error(`Idempotency key "${idempotencyKey}" was already used for a different annotation request`);
      }
      return {
        success: true,
        applied: existing.status === 'committed',
        duplicate: true,
        changeSet: this._clone(existing),
      };
    }

    const creator = this._principal(params, 'unknown-agent');
    const pendingForCreator = Object.values(ledger.changeSets).filter(
      changeSet =>
        changeSet?.createdBy === creator && ['awaiting_approval', 'approved'].includes(String(changeSet.status || ''))
    ).length;
    if (pendingForCreator >= this.ledgerLimits.pendingChangeSetsPerPrincipal) {
      throw new Error(
        `Principal "${creator}" already has ${pendingForCreator} pending annotation ChangeSets; review or resolve them before proposing more`
      );
    }

    const resolved = await this._resolveAnnotationTarget(params, ledger, workspace);
    const { target } = resolved;
    const found = await this._findFeatureByRef(target, workspace);
    if (!found) throw new Error(`Target feature ${target.featureId} is no longer available`);

    const proposal = params.annotationProposal || params.proposal || {};
    const proposalContract = await this._validateV2Proposal(proposal, target);
    const archivedDgrReport = proposalContract
      ? await this._requireArchivedDgrReport(proposal, target, params.researchRun || params.researchRunId)
      : null;
    if (archivedDgrReport) proposalContract.proposalMetadata.archivedDgrReport = archivedDgrReport;
    if (proposal.target && !proposalContract) this._assertProposalTarget(proposal.target, target);
    if (params.baseRevision !== undefined && Number(params.baseRevision) !== ledger.revision) {
      const requestedRevision = Number(params.baseRevision);
      if (
        !proposalContract ||
        !Number.isInteger(requestedRevision) ||
        requestedRevision !== proposalContract.proposalBaseRevision ||
        requestedRevision > ledger.revision
      ) {
        throw new Error(
          `Stale ChangeSet request: expected revision ${params.baseRevision}, current revision is ${ledger.revision}`
        );
      }
    }

    const rawOperations = this._proposalToOperations(params);
    if (rawOperations.length === 0) throw new Error('ChangeSet contains no supported annotation operations');
    this._validateOperationPayloads(rawOperations, 'resolved operations');
    const operations = rawOperations
      .map(operation => this._validateOperation({ ...operation }, found.annotation))
      .filter(operation => this._operationWouldChange(found.annotation, operation));
    if (operations.length === 0) {
      throw new Error('ChangeSet contains no effective annotation changes after existing qualifiers are considered');
    }
    const effectiveClaimIds = new Set(operations.flatMap(operation => operation.claimIds || []));
    const riskLevel = operations.some(
      operation =>
        operation.requiresHumanReview || operation.op === 'replaceQualifier' || operation.op === 'removeQualifier'
    )
      ? 'high'
      : operations.some(operation => ['product', 'EC_number', 'go_terms', 'ko', 'pathway'].includes(operation.field))
        ? 'medium'
        : 'low';
    let evidence = this._normaliseValues(params.evidence);
    if (evidence.length === 0) evidence = this._normaliseValues(proposal.evidence || []);
    if (evidence.length === 0 && proposalContract) {
      evidence = proposalContract.evidenceManifest.sourceRecords.map(record => record.id);
    }
    this._assertBoundedValues(
      evidence,
      'evidence',
      this.inputLimits.evidenceReferences,
      this.inputLimits.referenceLength
    );
    if (operations.some(operation => this.scientificQualifierFields.has(operation.field)) && evidence.length === 0) {
      throw new Error('Scientific annotation mutations require at least one bounded evidence reference');
    }
    const evidenceManifest = proposalContract?.evidenceManifest || null;
    const manifestHash = evidenceManifest ? await this._hash(evidenceManifest) : params.manifestHash || null;
    if (params.manifestHash && manifestHash && params.manifestHash !== manifestHash) {
      throw new Error('Provided evidence manifest hash does not match the proposal evidence manifest');
    }

    const changeSet = {
      schema: 'codexomics.annotation-change-set.v2',
      hashVersion: this.hashVersions.current,
      legacyIntegrity: null,
      targetFormat: 'current-v2',
      id: this._id('cs'),
      status: 'awaiting_approval',
      createdAt: new Date().toISOString(),
      createdBy: creator,
      idempotencyKey,
      requestHash,
      baseRevision: ledger.revision,
      proposalBaseRevision: proposalContract?.proposalBaseRevision ?? ledger.revision,
      target,
      evidence,
      evidenceManifest,
      claims: proposalContract?.claims?.filter(claim => effectiveClaimIds.has(claim.id)) || [],
      proposalMetadata: proposalContract?.proposalMetadata || null,
      researchRun: params.researchRun || params.researchRunId || null,
      manifestHash,
      operations,
      riskLevel,
      requiresHumanApproval: true,
      validation: {
        valid: true,
        checkedAt: new Date().toISOString(),
        allowedFields: Array.from(new Set(operations.map(operation => operation.field))),
      },
    };
    changeSet.changeSetHash = await this._hash(this._immutableChangeSetPayload(changeSet));
    this._ledgerMapSet(ledger.changeSets, changeSet.id, changeSet);
    this._ledgerMapSet(ledger.idempotencyKeys, idempotencyKey, { changeSetId: changeSet.id, requestHash });
    ledger.audit.push({
      id: this._id('audit'),
      event: 'changeset_created',
      changeSetId: changeSet.id,
      principal: changeSet.createdBy,
      timestamp: new Date().toISOString(),
      target: changeSet.target,
    });
    await this._saveLedger(ledger, workspace);
    return {
      success: true,
      applied: false,
      changeSet: this._clone(changeSet),
      preview: this._preview(changeSet, found.annotation),
    };
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

  _reviewPreview(changeSet, annotation, maxFields = 6) {
    const summaries = [];
    const seenFields = new Set();
    for (const item of this._preview(changeSet, annotation)) {
      if (seenFields.has(item.field)) continue;
      const before = this._compactReviewValue(item.before);
      const after = this._compactReviewValue(item.after);
      summaries.push({
        ...item,
        before: before.value,
        after: after.value,
        previewTruncated: before.truncated || after.truncated,
      });
      seenFields.add(item.field);
      if (summaries.length >= maxFields) break;
    }
    return summaries;
  }

  _compactReviewValue(value, maxCharacters = 240, maxItems = 8) {
    if (value === undefined || value === null) return { value: value ?? null, truncated: false };
    if (Array.isArray(value)) {
      const compacted = value.slice(0, maxItems).map(item => this._compactReviewValue(item, maxCharacters, 1));
      const truncated = value.length > maxItems || compacted.some(item => item.truncated);
      const result = compacted.map(item => item.value);
      if (value.length > maxItems) result.push(`… (+${value.length - maxItems} more)`);
      return { value: result, truncated };
    }
    if (typeof value === 'object') {
      return this._compactReviewValue(JSON.stringify(value), maxCharacters, maxItems);
    }
    if (typeof value !== 'string') return { value, truncated: false };
    if (value.length <= maxCharacters) return { value, truncated: false };
    return { value: `${value.slice(0, maxCharacters - 1)}…`, truncated: true };
  }

  async getAnnotationChangeset(params = {}) {
    this._requirePermissionWhenExternal(params, 'annotation:read');
    return this._withLedgerLock(async workspace => {
      const ledger = await this._loadLedger(workspace);
      const changeSet = this._ledgerMapGet(ledger.changeSets, params.changeSetId || params.id);
      if (!changeSet) throw new Error(`ChangeSet "${params.changeSetId || params.id}" not found`);
      return { success: true, changeSet: this._clone(changeSet) };
    });
  }

  async listAnnotationChangesets(params = {}) {
    this._requirePermissionWhenExternal(params, 'annotation:read');
    return this._withLedgerLock(async workspace => {
      const ledger = await this._loadLedger(workspace);
      const requestedStatuses = this._normaliseValues(params.status || params.statuses).map(value =>
        value.toLowerCase()
      );
      const requestedRisks = this._normaliseValues(params.riskLevel || params.riskLevels).map(value =>
        value.toLowerCase()
      );
      const query = String(params.query || params.identifier || '')
        .trim()
        .toLowerCase();
      const limit = Math.max(1, Math.min(Number(params.limit) || 100, 1000));
      const offset = Math.max(0, Number(params.offset) || 0);
      const allChangeSets = Object.values(ledger.changeSets || {}).filter(Boolean);
      const statusCounts = allChangeSets.reduce((counts, changeSet) => {
        const status = String(changeSet.status || 'unknown');
        counts[status] = (counts[status] || 0) + 1;
        return counts;
      }, {});
      const filtered = allChangeSets
        .filter(changeSet => {
          const status = String(changeSet.status || '').toLowerCase();
          const risk = String(changeSet.riskLevel || '').toLowerCase();
          if (requestedStatuses.length > 0 && !requestedStatuses.includes(status)) return false;
          if (requestedRisks.length > 0 && !requestedRisks.includes(risk)) return false;
          if (!query) return true;
          const target = changeSet.target || {};
          return [
            changeSet.id,
            target.geneSymbol,
            target.locusTag,
            target.proteinId,
            target.chromosome,
            target.organism,
          ]
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(query));
        })
        .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0));

      const page = filtered.slice(offset, offset + limit);
      const summaries = [];
      const featureCache = new Map();
      for (const changeSet of page) {
        const featureCacheKey =
          changeSet.target?.featureId ||
          [changeSet.target?.chromosome, changeSet.target?.locusTag, changeSet.target?.geneSymbol]
            .filter(Boolean)
            .join(':') ||
          changeSet.id;
        let found = featureCache.get(featureCacheKey);
        if (found === undefined) {
          found = await this._findFeatureByRef(changeSet.target, workspace);
          featureCache.set(featureCacheKey, found || null);
        }
        const preview = found ? this._reviewPreview(changeSet, found.annotation) : [];
        const approval = changeSet.approvalId ? this._ledgerMapGet(ledger.approvals, changeSet.approvalId) : null;
        summaries.push({
          id: changeSet.id,
          status: changeSet.status,
          createdAt: changeSet.createdAt,
          createdBy: changeSet.createdBy,
          baseRevision: changeSet.baseRevision,
          proposalBaseRevision: changeSet.proposalBaseRevision,
          target: this._clone(changeSet.target),
          riskLevel: changeSet.riskLevel,
          requiresHumanApproval: changeSet.requiresHumanApproval === true,
          operationCount: changeSet.operations?.length || 0,
          fields: Array.from(new Set((changeSet.operations || []).map(operation => operation.field))),
          evidenceCount: changeSet.evidence?.length || 0,
          researchRun: changeSet.researchRun || null,
          manifestHash: changeSet.manifestHash || null,
          changeSetHash: changeSet.changeSetHash || null,
          reportAttachment:
            changeSet.proposalMetadata?.archivedDgrReport?.attachmentId ||
            changeSet.proposalMetadata?.reportAttachment?.attachmentId ||
            null,
          targetAvailable: Boolean(found),
          preview: this._clone(preview),
          approval: approval
            ? {
                id: approval.id,
                approver: approval.approver,
                source: approval.source,
                approvedAt: approval.approvedAt,
                expiresAt: approval.expiresAt,
                revokedAt: approval.revokedAt || null,
              }
            : null,
          rejectedAt: changeSet.rejectedAt || null,
          rejectedBy: changeSet.rejectedBy || null,
          rejectionReason: changeSet.rejectionReason || null,
          committedAt: changeSet.commitReceipt?.committedAt || null,
          committedBy: changeSet.commitReceipt?.principal || null,
          resultingRevision: changeSet.commitReceipt?.revision ?? null,
        });
      }

      return {
        success: true,
        revision: ledger.revision,
        total: filtered.length,
        offset,
        limit,
        statusCounts,
        changeSets: summaries,
      };
    });
  }

  async requestAnnotationApproval(params = {}) {
    this._validatedExternalCurator(params, 'annotation:approve');
    return this._withLedgerLock(workspace => this._requestAnnotationApproval(params, workspace));
  }

  async rejectAnnotationChangeset(params = {}) {
    const externalCurator = this._validatedExternalCurator(params, 'annotation:approve');
    return this._withLedgerLock(async workspace => {
      this._assertDurableLedger(workspace);
      const ledger = await this._loadLedger(workspace);
      const changeSet = this._ledgerMapGet(ledger.changeSets, params.changeSetId || params.id);
      if (!changeSet) throw new Error('ChangeSet not found');
      if (!['awaiting_approval', 'approved'].includes(changeSet.status)) {
        throw new Error(`ChangeSet is ${changeSet.status}, not eligible for rejection`);
      }

      const context = externalCurator?.context || null;
      const approval = changeSet.approvalId ? this._ledgerMapGet(ledger.approvals, changeSet.approvalId) : null;
      if (changeSet.status === 'approved' && (!changeSet.approvalId || !approval)) {
        await this._markStale(ledger, changeSet, 'approved_changeset_missing_approval_record', workspace);
        throw new Error('Approved ChangeSet references a missing approval record and was marked stale');
      }
      if (changeSet.approvalId && !this._isApprovalBoundToChangeSet(approval, changeSet)) {
        await this._markStale(ledger, changeSet, 'approval_binding_invalid_before_rejection', workspace);
        throw new Error('ChangeSet approval binding is invalid and was marked stale instead of rejected');
      }

      const currentChangeSetHash = await this._hash(this._immutableChangeSetPayload(changeSet));
      if (!changeSet.changeSetHash || currentChangeSetHash !== changeSet.changeSetHash) {
        await this._markStale(ledger, changeSet, 'immutable_changeset_payload_changed_before_rejection', workspace);
        throw new Error('ChangeSet payload changed after creation; it was marked stale instead of rejected');
      }

      let curator;
      if (context) {
        curator = externalCurator.principal;
      } else {
        const prompt = `Reject annotation ChangeSet ${changeSet.id}? This records the decision and prevents commit.`;
        let decision;
        if (typeof this.app?.confirmAnnotationChangeSet === 'function') {
          decision = await this.app.confirmAnnotationChangeSet({
            action: 'reject',
            changeSet: this._clone(changeSet),
            prompt,
          });
          this._assertWorkspace(workspace);
        } else if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          decision = window.confirm(prompt);
        } else {
          throw new Error('A trusted interactive curator confirmation UI is required for local rejection');
        }
        const confirmed = decision === true || decision?.rejected === true || decision?.confirmed === true;
        if (!confirmed) throw new Error('Annotation ChangeSet rejection was cancelled by the local curator');
        curator = String(decision?.principal || this.app?.localCuratorIdentity || 'local-curator').trim();
      }
      if (!curator) throw new Error('Authenticated curator identity is missing');
      const reason = this._assertBoundedScalar(
        params.reason || 'curator_rejected',
        'rejection reason',
        this.inputLimits.referenceLength,
        { required: true }
      );
      const rejectedAt = new Date().toISOString();
      if (approval && !approval.revokedAt) {
        approval.revokedAt = rejectedAt;
        approval.revokedBy = curator;
        approval.revocationReason = 'changeset_rejected';
        ledger.audit.push({
          id: this._id('audit'),
          event: 'annotation_approval_revoked',
          changeSetId: changeSet.id,
          approvalId: approval.id,
          principal: curator,
          timestamp: rejectedAt,
          reason: 'changeset_rejected',
        });
      }
      changeSet.status = 'rejected';
      changeSet.rejectedAt = rejectedAt;
      changeSet.rejectedBy = curator;
      changeSet.rejectionReason = reason;
      ledger.audit.push({
        id: this._id('audit'),
        event: 'changeset_rejected',
        changeSetId: changeSet.id,
        approvalId: approval?.id || null,
        principal: curator,
        timestamp: rejectedAt,
        reason,
      });
      await this._saveLedger(ledger, workspace);
      return { success: true, changeSet: this._clone(changeSet) };
    });
  }

  async _requestAnnotationApproval(params = {}, workspace) {
    const externalCurator = this._validatedExternalCurator(params, 'annotation:approve');
    this._assertDurableLedger(workspace);
    const ledger = await this._loadLedger(workspace);
    const changeSet = this._ledgerMapGet(ledger.changeSets, params.changeSetId || params.id);
    if (!changeSet) throw new Error('ChangeSet not found');
    if (!['awaiting_approval', 'approved'].includes(changeSet.status)) {
      throw new Error(`ChangeSet is ${changeSet.status}, not eligible for approval`);
    }
    const previousApproval =
      changeSet.status === 'approved' ? this._ledgerMapGet(ledger.approvals, changeSet.approvalId) : null;
    if (changeSet.status === 'approved' && !this._isApprovalBoundToChangeSet(previousApproval, changeSet)) {
      await this._markStale(ledger, changeSet, 'approval_binding_invalid_before_reapproval', workspace);
      throw new Error('Approved ChangeSet has an invalid approval binding and was marked stale');
    }
    if (changeSet.status === 'awaiting_approval' && changeSet.approvalId) {
      await this._markStale(ledger, changeSet, 'unexpected_approval_binding_before_approval', workspace);
      throw new Error('Awaiting-review ChangeSet has an unexpected approval binding and was marked stale');
    }
    const currentChangeSetHash = await this._hash(this._immutableChangeSetPayload(changeSet));
    if (!changeSet.changeSetHash || currentChangeSetHash !== changeSet.changeSetHash) {
      await this._markStale(ledger, changeSet, 'immutable_changeset_payload_changed_before_approval', workspace);
      throw new Error('ChangeSet payload changed after creation; create and review a new ChangeSet');
    }
    const context = externalCurator?.context || null;
    let approver;
    let approvalSource;
    if (context) {
      approver = externalCurator.principal;
      approvalSource = 'authenticated-mcp';
    } else {
      const previewTarget = await this._findFeatureByRef(changeSet.target, workspace);
      const preview = previewTarget ? this._preview(changeSet, previewTarget.annotation) : [];
      const prompt =
        `Approve annotation ChangeSet ${changeSet.id}?\n` +
        `Risk: ${changeSet.riskLevel}\n` +
        preview
          .map(item => `${item.op} ${item.field}: ${JSON.stringify(item.before)} -> ${JSON.stringify(item.after)}`)
          .join('\n');
      let decision;
      if (typeof this.app?.confirmAnnotationChangeSet === 'function') {
        decision = await this.app.confirmAnnotationChangeSet({ changeSet: this._clone(changeSet), preview, prompt });
        this._assertWorkspace(workspace);
      } else if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        decision = window.confirm(prompt);
      } else {
        throw new Error('A trusted interactive curator confirmation UI is required for local approval');
      }
      const approved = decision === true || decision?.approved === true;
      if (!approved) throw new Error('Annotation ChangeSet approval was declined by the local curator');
      approver = String(decision?.principal || this.app?.localCuratorIdentity || 'local-curator').trim();
      approvalSource = 'local-interactive';
    }
    if (!approver) throw new Error('Authenticated curator identity is missing');
    if (approver === changeSet.createdBy) {
      throw new Error('The ChangeSet creator cannot self-approve an autonomous annotation change');
    }
    if (previousApproval) {
      previousApproval.revokedAt = new Date().toISOString();
      previousApproval.revokedBy = approver;
      previousApproval.revocationReason = 'approval_capability_reissued';
      ledger.audit.push({
        id: this._id('audit'),
        event: 'annotation_approval_revoked',
        changeSetId: changeSet.id,
        approvalId: previousApproval.id,
        principal: approver,
        timestamp: previousApproval.revokedAt,
        reason: previousApproval.revocationReason,
      });
    }
    const expiresAt = new Date(
      Date.now() + Math.max(1, Math.min(Number(params.expiresInMinutes) || 30, 24 * 60)) * 60000
    ).toISOString();
    const token = this._approvalToken();
    const approval = {
      id: this._id('approval'),
      changeSetId: changeSet.id,
      changeSetHash: changeSet.changeSetHash,
      baseRevision: changeSet.baseRevision,
      approver,
      source: approvalSource,
      approvedAt: new Date().toISOString(),
      expiresAt,
      tokenHash: await this._secureCapabilityHash(token),
      replacesApprovalId: previousApproval?.id || null,
    };
    this._ledgerMapSet(ledger.approvals, approval.id, approval);
    changeSet.status = 'approved';
    changeSet.approvalId = approval.id;
    ledger.audit.push({
      id: this._id('audit'),
      event: previousApproval ? 'changeset_reapproved' : 'changeset_approved',
      changeSetId: changeSet.id,
      principal: approver,
      timestamp: approval.approvedAt,
    });
    await this._saveLedger(ledger, workspace);
    const publicApproval = this._clone(approval);
    delete publicApproval.tokenHash;
    return { success: true, approval: publicApproval, approvalToken: token };
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
    this._validatedExternalCurator(params, 'annotation:commit');
    return this._withLedgerLock(workspace => this._applyAnnotationChangeset(params, workspace));
  }

  async _markStale(ledger, changeSet, reason, workspace) {
    const staleAt = new Date().toISOString();
    const approval = changeSet.approvalId ? this._ledgerMapGet(ledger.approvals, changeSet.approvalId) : null;
    const approvalBound = this._isApprovalBoundToChangeSet(approval, changeSet);
    const approvalOwned = this._isApprovalOwnedByChangeSet(approval, changeSet);
    if (changeSet.approvalId && !approvalBound) {
      ledger.audit.push({
        id: this._id('audit'),
        event: 'annotation_approval_binding_invalid',
        changeSetId: changeSet.id,
        referencedApprovalId: changeSet.approvalId,
        referencedApprovalChangeSetId: approval?.changeSetId || null,
        principal: 'validation-service',
        timestamp: staleAt,
        reason,
      });
    }
    if (approvalOwned && !approval.revokedAt) {
      approval.revokedAt = staleAt;
      approval.revokedBy = 'validation-service';
      approval.revocationReason = `changeset_stale:${reason}`;
      ledger.audit.push({
        id: this._id('audit'),
        event: 'annotation_approval_revoked',
        changeSetId: changeSet.id,
        approvalId: approval.id,
        principal: 'validation-service',
        timestamp: staleAt,
        reason: approval.revocationReason,
      });
    }
    changeSet.status = 'stale';
    ledger.audit.push({
      id: this._id('audit'),
      event: 'changeset_stale',
      changeSetId: changeSet.id,
      principal: 'validation-service',
      timestamp: staleAt,
      reason,
    });
    await this._saveLedger(ledger, workspace);
  }

  async _applyAnnotationChangeset(params = {}, workspace) {
    this._assertDurableLedger(workspace);
    const ledger = await this._loadLedger(workspace);
    const changeSet = this._ledgerMapGet(ledger.changeSets, params.changeSetId || params.id);
    if (!changeSet) throw new Error('ChangeSet not found');
    const committedReceipt = this._ledgerMapGet(ledger.committedIdempotencyKeys, changeSet.idempotencyKey);
    if (committedReceipt) {
      this._assertIndexedCommitReceipt(changeSet, committedReceipt);
      return {
        success: true,
        duplicate: true,
        receipt: this._clone(committedReceipt),
      };
    }
    if (changeSet.status === 'committed') {
      throw new Error(`Annotation ledger committed idempotency index is missing for ChangeSet ${changeSet.id}`);
    }
    if (changeSet.status !== 'approved') {
      throw new Error(`ChangeSet is ${changeSet.status}; approval is required before commit`);
    }
    const approval = this._ledgerMapGet(ledger.approvals, changeSet.approvalId);
    const context = this._executionContext(params);
    let commitPrincipal;
    if (context) {
      if (!this._hasPermission(context, 'annotation:commit')) {
        throw new Error('Authenticated curator permission "annotation:commit" is required');
      }
      commitPrincipal = String(context.principal || '').trim();
    } else if (approval?.source === 'local-interactive') {
      commitPrincipal = approval.approver;
    } else {
      throw new Error('Authenticated curator permission "annotation:commit" is required');
    }
    if (!this._isApprovalBoundToChangeSet(approval, changeSet)) {
      await this._markStale(ledger, changeSet, 'approval_binding_invalid_before_commit', workspace);
      throw new Error('ChangeSet approval binding is invalid; create and review a new ChangeSet');
    }
    if (approval.revokedAt) {
      throw new Error('A valid, unexpired approval capability is required before commit');
    }
    if (!Number.isFinite(Date.parse(approval.expiresAt)) || new Date(approval.expiresAt).getTime() < Date.now()) {
      approval.expiredAt = new Date().toISOString();
      changeSet.status = 'awaiting_approval';
      delete changeSet.approvalId;
      ledger.audit.push({
        id: this._id('audit'),
        event: 'annotation_approval_expired',
        changeSetId: changeSet.id,
        approvalId: approval.id,
        principal: 'validation-service',
        timestamp: approval.expiredAt,
      });
      await this._saveLedger(ledger, workspace);
      throw new Error('The annotation approval capability expired; request a new approval capability');
    }
    const suppliedTokenHash = params.approvalToken
      ? await this._secureCapabilityHash(String(params.approvalToken))
      : null;
    if (!suppliedTokenHash || approval.tokenHash !== suppliedTokenHash) {
      throw new Error('A valid, unexpired approval capability is required before commit');
    }
    const currentChangeSetHash = await this._hash(this._immutableChangeSetPayload(changeSet));
    if (currentChangeSetHash !== changeSet.changeSetHash || currentChangeSetHash !== approval.changeSetHash) {
      await this._markStale(ledger, changeSet, 'immutable_changeset_payload_changed_after_approval', workspace);
      throw new Error('ChangeSet payload changed after approval; create and review a new ChangeSet');
    }
    const found = await this._findFeatureByRef(changeSet.target, workspace);
    if (!found) {
      await this._markStale(ledger, changeSet, 'target_feature_missing', workspace);
      throw new Error('ChangeSet target feature is no longer available');
    }
    if (found.ref.featureHash !== changeSet.target.featureHash) {
      await this._markStale(ledger, changeSet, 'target_feature_hash_changed', workspace);
      throw new Error(
        'ChangeSet is stale: target has changed since preview; create a new proposal against the current feature revision'
      );
    }

    this._assertCommitDeadline(params);

    const workingCopy = JSON.parse(JSON.stringify(found.annotation));
    const appliedOperations = [];
    for (const operation of changeSet.operations) {
      const oldValue = this._applyOperation(workingCopy, operation);
      appliedOperations.push({ ...operation, oldValue });
    }

    const previousRevision = ledger.revision;
    ledger.revision = previousRevision + 1;
    const resultingTarget = await this._featureRef(found.chromosome, workingCopy, ledger, workspace);
    const receipt = {
      hashVersion: this.hashVersions.current,
      legacyIntegrity: null,
      id: this._id('commit'),
      changeSetId: changeSet.id,
      committedAt: new Date().toISOString(),
      principal: commitPrincipal,
      approvedBy: approval.approver,
      previousRevision,
      revision: ledger.revision,
      target: changeSet.target,
      resultingFeatureHash: resultingTarget.featureHash,
      appliedOperations,
      evidence: changeSet.evidence,
      manifestHash: changeSet.manifestHash,
    };
    receipt.receiptHash = await this._hash(receipt);
    changeSet.status = 'committed';
    changeSet.commitReceipt = receipt;
    this._ledgerMapSet(ledger.committedIdempotencyKeys, changeSet.idempotencyKey, receipt);
    ledger.audit.push({
      id: this._id('audit'),
      event: 'changeset_committed',
      changeSetId: changeSet.id,
      principal: commitPrincipal,
      timestamp: receipt.committedAt,
      receiptId: receipt.id,
    });

    // Persist the commit receipt before changing live renderer state. A disk
    // failure leaves the reviewed annotation untouched and safe to retry.
    await this._saveLedger(ledger, workspace);

    const liveTargetBeforeSwap = await this._featureRef(found.chromosome, found.annotation, ledger, workspace);
    const liveAlreadyMatchesReceipt = liveTargetBeforeSwap.featureHash === receipt.resultingFeatureHash;
    if (liveTargetBeforeSwap.featureHash !== changeSet.target.featureHash && !liveAlreadyMatchesReceipt) {
      const detectedAt = new Date().toISOString();
      changeSet.reconciliationConflict = {
        detectedAt,
        expectedFeatureHash: changeSet.target.featureHash,
        liveFeatureHash: liveTargetBeforeSwap.featureHash,
        resultingFeatureHash: receipt.resultingFeatureHash,
        reason: 'live_feature_changed_after_commit_receipt_persisted',
      };
      ledger.audit.push({
        id: this._id('audit'),
        event: 'commit_reconciliation_required',
        changeSetId: changeSet.id,
        principal: 'validation-service',
        timestamp: detectedAt,
        reason: changeSet.reconciliationConflict.reason,
      });
      await this._saveLedger(ledger, workspace);
      throw new Error(
        'The commit receipt was persisted, but the live annotation changed before materialization; no live data was overwritten and reconciliation is required'
      );
    }

    // Atomic renderer-side swap: no live annotation changes until every
    // operation has been validated and the durable receipt has been written.
    this._assertWorkspace(workspace);
    if (!liveAlreadyMatchesReceipt) {
      Object.keys(found.annotation).forEach(key => delete found.annotation[key]);
      Object.assign(found.annotation, workingCopy);
    }

    const tracker = this.annotationService._getChangeTracker();
    for (const operation of appliedOperations) {
      tracker.recordChange({
        action: 'update',
        annotationId: changeSet.target.featureId,
        chromosome: found.chromosome,
        field: operation.field,
        oldValue: operation.oldValue ?? null,
        newValue: found.annotation.qualifiers?.[operation.field] ?? null,
        agent: commitPrincipal,
        source: 'changeset',
        evidence: changeSet.evidence,
        metadata: { changeSetId: changeSet.id, receiptId: receipt.id },
      });
    }
    const selectedGene = this.app?.selectedGene?.gene;
    if (
      this._annotationMatchesTarget(selectedGene, changeSet.target) &&
      typeof this.app.populateGeneDetails === 'function'
    ) {
      this.app.selectedGene.gene = found.annotation;
      this.app.populateGeneDetails(found.annotation, this.app.selectedGene.operonInfo);
    }
    return {
      success: true,
      applied: true,
      receipt: this._clone(receipt),
      annotation: this._clone(found.annotation),
    };
  }

  async rollbackAnnotationChangeset(params = {}) {
    this._requirePermissionWhenExternal(params, 'annotation:propose');
    return this._withLedgerLock(workspace => this._rollbackAnnotationChangeset(params, workspace));
  }

  async _rollbackAnnotationChangeset(params = {}, workspace) {
    const ledger = await this._loadLedger(workspace);
    const original = this._ledgerMapGet(ledger.changeSets, params.changeSetId || params.id);
    if (!original?.commitReceipt) throw new Error('Only a committed ChangeSet can be rolled back');
    const target = original.target;
    const originalValues = new Map();
    for (const operation of original.commitReceipt.appliedOperations) {
      if (!originalValues.has(operation.field)) originalValues.set(operation.field, operation.oldValue);
    }
    const operations = Array.from(originalValues, ([field, oldValue]) => ({
      op: oldValue === undefined || oldValue === null ? 'removeQualifier' : 'replaceQualifier',
      field,
      value: oldValue,
      requiresHumanReview: true,
    }));
    return this._createAnnotationChangeset(
      {
        identifier: target.annotationId || target.locusTag || target.geneSymbol || target.proteinId,
        chromosome: target.chromosome,
        baseRevision: ledger.revision,
        operations,
        evidence: [`rollback:${original.commitReceipt.id}`],
        principal: params.principal || params.agent || 'rollback-service',
        researchRun: `rollback:${original.id}`,
        idempotencyKey: params.idempotencyKey || `rollback:${original.id}:${ledger.revision}`,
        __executionContext: this._executionContext(params),
      },
      workspace
    );
  }

  async getAnnotationAudit(params = {}) {
    this._requirePermissionWhenExternal(params, 'annotation:read');
    return this._withLedgerLock(async workspace => {
      const ledger = await this._loadLedger(workspace);
      const limit = Math.max(1, Math.min(Number(params.limit) || 100, 1000));
      return { success: true, revision: ledger.revision, audit: this._clone(ledger.audit.slice(-limit).reverse()) };
    });
  }
}

if (typeof window !== 'undefined') {
  window.AnnotationChangeSetService = AnnotationChangeSetService;
}
