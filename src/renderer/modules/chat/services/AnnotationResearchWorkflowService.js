// @ts-check
/**
 * Deterministic internal orchestration for CodeXomics ChatBox + DGR MCP.
 * LLMs can choose a research intent, but task creation, polling, target
 * binding, and ChangeSet creation are handled here rather than by a free-form
 * tool loop.
 */
class AnnotationResearchWorkflowService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
    this.memoryRuns = new Map();
    this.runLocks = new Map();
    this.runLimits = Object.freeze({
      total: 2000,
      activePerPrincipal: 100,
      serializedBytes: 8 * 1024 * 1024,
      proposalBytes: 512 * 1024,
      taskIdLength: 256,
    });
    this.terminalStatuses = new Set(['completed', 'failed', 'cancelled', 'canceled']);
    this.supportedFeatureTypes = new Set([
      'CDS',
      'GENE',
      'MRNA',
      'TRNA',
      'RRNA',
      'NCRNA',
      'TMRNA',
      'MISC_RNA',
      'PRECURSOR_RNA',
      'MIRNA',
      'SNRNA',
      'SNORNA',
      'ANTISENSE_RNA',
      'GUIDE_RNA',
      'TELOMERASE_RNA',
      'RNASE_P_RNA',
      'RNASE_MRP_RNA',
      'PSEUDOGENE',
    ]);
  }

  _clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  _isPlainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  _createRunMap(value = {}) {
    const result = Object.create(null);
    for (const key of Object.keys(value || {})) this._runMapSet(result, key, value[key]);
    return result;
  }

  _runMapGet(map, key) {
    if (!map || key === undefined || key === null) return undefined;
    const property = String(key);
    return Object.prototype.hasOwnProperty.call(map, property) ? map[property] : undefined;
  }

  _runMapSet(map, key, value) {
    Object.defineProperty(map, String(key), {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    return value;
  }

  _serializedBytes(value) {
    const serialized = JSON.stringify(value);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(serialized).byteLength;
    return serialized.length * 2;
  }

  _validateRunCollection(runs) {
    const entries = Object.entries(runs || {});
    if (entries.length > this.runLimits.total) {
      throw new Error(
        `Annotation research history exceeds the ${this.runLimits.total}-run retention ceiling; archive completed research history before continuing`
      );
    }
    if (this._serializedBytes(runs) > this.runLimits.serializedBytes) {
      throw new Error(
        `Annotation research history exceeds the ${this.runLimits.serializedBytes}-byte retention ceiling; archive completed research history before continuing`
      );
    }
    for (const [taskId, workflow] of entries) {
      if (!this._isPlainRecord(workflow) || workflow.taskId !== taskId) {
        throw new Error(`Annotation research workflow ${taskId} has an invalid durable record`);
      }
    }
  }

  _assertCanStartRun(runs, principal, provisionalWorkflow) {
    const entries = Object.values(runs || {});
    if (entries.length >= this.runLimits.total) {
      throw new Error(
        `Annotation research history reached the ${this.runLimits.total}-run retention ceiling; archive completed research history before starting another run`
      );
    }
    const activeForPrincipal = entries.filter(
      workflow =>
        workflow?.initiatedBy === principal && !this.terminalStatuses.has(String(workflow.status || '').toLowerCase())
    ).length;
    if (activeForPrincipal >= this.runLimits.activePerPrincipal) {
      throw new Error(
        `Research principal ${principal} already has ${this.runLimits.activePerPrincipal} active annotation research runs`
      );
    }
    const projectedRuns = this._createRunMap(this._clone(runs));
    let placeholderTaskId = '\u0800'.repeat(this.runLimits.taskIdLength);
    if (this._runMapGet(projectedRuns, placeholderTaskId)) {
      placeholderTaskId = '\u0801'.repeat(this.runLimits.taskIdLength);
    }
    if (this._runMapGet(projectedRuns, placeholderTaskId)) {
      throw new Error('Annotation research history contains reserved capacity-projection task IDs');
    }
    this._runMapSet(projectedRuns, placeholderTaskId, {
      ...provisionalWorkflow,
      taskId: placeholderTaskId,
    });
    this._validateRunCollection(projectedRuns);
  }

  _boundedPersistedString(value, label, maximumLength) {
    if (typeof value !== 'string' || !value.trim() || value.length > maximumLength) {
      throw new Error(`${label} must be a non-empty string of at most ${maximumLength} characters`);
    }
    return value;
  }

  _currentAnnotationSnapshot(resolved) {
    if (this._isPlainRecord(resolved?.currentAnnotation)) {
      return this._clone(resolved.currentAnnotation);
    }
    const qualifiers = this._isPlainRecord(resolved?.annotation?.qualifiers) ? resolved.annotation.qualifiers : {};
    const boundedValues = (names, maximumItems, maximumLength) => {
      const result = [];
      const seen = new Set();
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

  _initialRunStatus(value) {
    return typeof value === 'string' && value.trim() && value.length <= 64 ? value : 'pending';
  }

  _optionalRemoteString(value, maximumLength) {
    return typeof value === 'string' && value.length <= maximumLength ? value : null;
  }

  _genomePath() {
    return (
      this.app?.loadedGenomePath ||
      this.app?.fileManager?.genomeBrowser?.loadedGenomePath ||
      this.app?.currentFile?.path ||
      this.app?.fileManager?.currentFile?.path ||
      null
    );
  }

  _captureWorkspace() {
    const genomePath = this._genomePath();
    return Object.freeze({
      genomePath,
      annotations: this.app?.currentAnnotations || null,
      key: genomePath || this.app?.currentGenomeName || this.app?.currentChromosome || 'unsaved-genome',
    });
  }

  _assertWorkspace(workspace) {
    if (
      !workspace ||
      workspace.genomePath !== this._genomePath() ||
      workspace.annotations !== (this.app?.currentAnnotations || null)
    ) {
      throw new Error('The loaded genome workspace changed while the research workflow was in progress; retry it');
    }
  }

  async _loadRuns(workspace) {
    this._assertWorkspace(workspace);
    const path = workspace.genomePath;
    if (path && this.app?.sidecarManager) {
      const runs = await this.app.sidecarManager.get(path, 'annotationResearchRuns', { strict: true });
      this._assertWorkspace(workspace);
      if (runs === undefined || runs === null) return this._createRunMap();
      if (!this._isPlainRecord(runs)) throw new Error('Annotation research runs must be a JSON object');
      const normalized = this._createRunMap(this._clone(runs));
      this._validateRunCollection(normalized);
      return normalized;
    }
    const normalized = this.memoryRuns.has(workspace.key)
      ? this._createRunMap(this._clone(this.memoryRuns.get(workspace.key)))
      : this._createRunMap();
    this._validateRunCollection(normalized);
    return normalized;
  }

  async _saveRuns(runs, workspace) {
    this._assertWorkspace(workspace);
    const path = workspace.genomePath;
    const snapshot = this._clone(runs);
    this._validateRunCollection(snapshot);
    if (path && this.app?.sidecarManager) {
      if (typeof this.app.sidecarManager.setAndForceSave === 'function') {
        await this.app.sidecarManager.setAndForceSave(path, 'annotationResearchRuns', snapshot);
      } else {
        await this.app.sidecarManager.set(path, 'annotationResearchRuns', snapshot);
        await this.app.sidecarManager.forceSave(path);
      }
    }
    this._assertWorkspace(workspace);
    this.memoryRuns.set(workspace.key, this._clone(snapshot));
  }

  async _withRunsLock(operation) {
    const workspace = this._captureWorkspace();
    const key = workspace.key;
    const previous = this.runLocks.get(key) || Promise.resolve();
    let release;
    const gate = new Promise(resolve => {
      release = resolve;
    });
    const tail = previous.catch(() => {}).then(() => gate);
    this.runLocks.set(key, tail);
    await previous.catch(() => {});
    try {
      this._assertWorkspace(workspace);
      const result = await operation(workspace);
      this._assertWorkspace(workspace);
      return result;
    } finally {
      release();
      if (this.runLocks.get(key) === tail) this.runLocks.delete(key);
    }
  }

  _annotationService() {
    const service = this.chatManager.services?.annotation;
    if (!service) throw new Error('Annotation service is unavailable');
    return service;
  }

  _manager() {
    const manager = this.chatManager.mcpServerManager;
    if (!manager) throw new Error('MCP Server Manager is unavailable');
    return manager;
  }

  _normaliseResearchIdentity(value) {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  _researchTargetKeys(target = {}) {
    const keys = new Set();
    const chromosome = this._normaliseResearchIdentity(target.chromosome);
    const scoped = value => `${chromosome || '*'}:${this._normaliseResearchIdentity(value)}`;
    if (target.locusTag) keys.add(`locus:${scoped(target.locusTag)}`);
    if (target.proteinId) keys.add(`protein:${scoped(target.proteinId)}`);
    if (target.featureId) keys.add(`feature:${this._normaliseResearchIdentity(target.featureId)}`);
    if (target.geneSymbol || target.gene) keys.add(`gene:${scoped(target.geneSymbol || target.gene)}`);
    const coordinates = target.coordinates || target;
    if (coordinates.start !== undefined && coordinates.end !== undefined) {
      keys.add(
        `location:${chromosome || '*'}:${Number(coordinates.start)}:${Number(coordinates.end)}:${Number(
          coordinates.strand ?? target.strand ?? 0
        )}`
      );
    }
    return Array.from(keys);
  }

  _researchTargetsOverlap(left, right) {
    const leftKeys = new Set(this._researchTargetKeys(left));
    return this._researchTargetKeys(right).some(key => leftKeys.has(key));
  }

  _workflowCoverageState(workflow) {
    const status = String(workflow?.status || 'unknown').toLowerCase();
    if (!this.terminalStatuses.has(status)) return 'active';
    if (status === 'completed') {
      return workflow?.reportAttachment?.attachmentId && workflow?.reportAttachment?.sha256
        ? 'completed'
        : 'completed_unarchived';
    }
    if (status === 'failed') return 'failed';
    return 'cancelled';
  }

  _workflowCoverageSummary(workflow) {
    const coverageState = this._workflowCoverageState(workflow);
    const attachment = workflow?.reportAttachment;
    const completedAt =
      workflow?.reportArchivedAt ||
      attachment?.storedAt ||
      (coverageState === 'completed' ? workflow?.updatedAt : null);
    return {
      taskId: workflow?.taskId || null,
      status: workflow?.status || 'unknown',
      coverageState,
      covered: coverageState === 'active' || coverageState === 'completed',
      retryRecommended: ['completed_unarchived', 'failed', 'cancelled'].includes(coverageState),
      target: this._clone(workflow?.target || {}),
      targetKeys: this._researchTargetKeys(workflow?.target || {}),
      createdAt: workflow?.createdAt || null,
      updatedAt: workflow?.updatedAt || null,
      completedAt: completedAt || null,
      initiatedBy: workflow?.initiatedBy || null,
      changeSetId: workflow?.changeSetId || null,
      changeSetStatus: workflow?.changeSetStatus || null,
      reportAttachment: attachment
        ? {
            attachmentId: attachment.attachmentId || null,
            geneId: attachment.geneId || null,
            fileName: attachment.fileName || null,
            sha256: attachment.sha256 || null,
            storedAt: attachment.storedAt || null,
          }
        : null,
    };
  }

  _normaliseResearchRefreshDays(value) {
    if (value === undefined || value === null || value === '') return null;
    const days = Number(value);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      throw new Error('researchRefreshDays must be an integer from 1 to 3650 when provided');
    }
    return days;
  }

  _isFreshCompletedCoverage(summary, refreshDays, now = Date.now()) {
    if (summary.coverageState !== 'completed' || refreshDays === null) return summary.coverageState === 'completed';
    const completedAt = Date.parse(summary.completedAt || summary.updatedAt || summary.createdAt || '');
    if (!Number.isFinite(completedAt)) return true;
    return now - completedAt < refreshDays * 24 * 60 * 60 * 1000;
  }

  async getAnnotationResearchCoverageIndex(params = {}) {
    const refreshDays = this._normaliseResearchRefreshDays(params.researchRefreshDays);
    return this._withRunsLock(async workspace => {
      const runs = await this._loadRuns(workspace);
      const entries = Object.values(runs)
        .filter(Boolean)
        .map(workflow => {
          const summary = this._workflowCoverageSummary(workflow);
          return {
            ...summary,
            effectiveCovered:
              summary.coverageState === 'active' || this._isFreshCompletedCoverage(summary, refreshDays),
          };
        });
      return { refreshDays, entries };
    });
  }

  async listAnnotationResearchHistory(params = {}) {
    this._requireResearchPermission(params);
    const coverage = await this.getAnnotationResearchCoverageIndex(params);
    const requestedStates = new Set(
      (Array.isArray(params.coverageStates)
        ? params.coverageStates
        : params.coverageState
          ? [params.coverageState]
          : []
      )
        .map(value => String(value || '').toLowerCase())
        .filter(Boolean)
    );
    const query = this._normaliseResearchIdentity(params.identifier || params.query);
    const limit = Math.max(0, Math.min(Number(params.limit ?? 100), this.runLimits.total));
    const offset = Math.max(0, Number(params.offset) || 0);
    let history = coverage.entries
      .filter(entry => requestedStates.size === 0 || requestedStates.has(entry.coverageState))
      .filter(entry => !params.coveredOnly || entry.effectiveCovered)
      .filter(entry => {
        if (!query) return true;
        const target = entry.target || {};
        return [entry.taskId, target.featureId, target.locusTag, target.proteinId, target.geneSymbol]
          .filter(Boolean)
          .some(value => this._normaliseResearchIdentity(value).includes(query));
      })
      .sort(
        (left, right) =>
          Date.parse(right.completedAt || right.updatedAt || right.createdAt || 0) -
          Date.parse(left.completedAt || left.updatedAt || left.createdAt || 0)
      );
    if (params.latestPerTarget === true) {
      const seen = new Set();
      history = history.filter(entry => {
        const key = entry.targetKeys[0] || `task:${entry.taskId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    const total = history.length;
    const page = limit === 0 ? history.slice(offset) : history.slice(offset, offset + limit);
    return {
      success: true,
      schema: 'codexomics.annotation-research-history.v1',
      researchRefreshDays: coverage.refreshDays,
      total,
      offset,
      limit,
      count: page.length,
      coveredCount: history.filter(entry => entry.effectiveCovered).length,
      history: this._clone(page),
    };
  }

  _normaliseOrganism(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (typeof this.app?.standardizeOrganismName === 'function') {
      return String(this.app.standardizeOrganismName(text) || '')
        .trim()
        .toLowerCase();
    }
    return text.replace(/\s+/g, ' ').toLowerCase();
  }

  _requireResearchPermission(params) {
    const context = params?.__executionContext;
    if (!context) return;
    const permissions = Array.isArray(context.permissions) ? context.permissions : [];
    if (
      context.authenticated !== true ||
      (context.isAdmin !== true && !permissions.includes('*') && !permissions.includes('annotation:research'))
    ) {
      throw new Error('Authenticated MCP permission "annotation:research" is required');
    }
    if (!String(context.principal || '').trim()) {
      throw new Error('Authenticated MCP researcher identity is required');
    }
  }

  _canProposeAnnotation(params) {
    const context = params?.__executionContext;
    if (!context) return true;
    const permissions = Array.isArray(context.permissions) ? context.permissions : [];
    return (
      context.authenticated === true &&
      (context.isAdmin === true || permissions.includes('*') || permissions.includes('annotation:propose'))
    );
  }

  _canonicalise(value) {
    if (Array.isArray(value)) return value.map(item => this._canonicalise(item));
    if (value && typeof value === 'object') {
      const result = Object.create(null);
      for (const key of Object.keys(value).sort()) {
        if (value[key] !== undefined) this._runMapSet(result, key, this._canonicalise(value[key]));
      }
      return result;
    }
    return value;
  }

  async _hash(value) {
    const input = JSON.stringify(this._canonicalise(value));
    if (globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    }
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a-${(hash >>> 0).toString(16)}`;
  }

  async _boundCompletedProposal(workflow, status, workspace) {
    const returnedProposal = status.result?.annotationProposal;
    if (workflow.proposalSnapshot) {
      const snapshotHash = await this._hash(workflow.proposalSnapshot);
      this._assertWorkspace(workspace);
      if (!workflow.proposalHash || snapshotHash !== workflow.proposalHash) {
        throw new Error(
          `Stored annotation proposal for research task ${workflow.taskId} failed integrity verification`
        );
      }
      if (workflow.reportAttachment?.proposalSha256 && snapshotHash !== workflow.reportAttachment.proposalSha256) {
        throw new Error(
          `Stored annotation proposal for research task ${workflow.taskId} does not match its archived full report`
        );
      }
      if (returnedProposal) {
        const returnedHash = await this._hash(returnedProposal);
        this._assertWorkspace(workspace);
        if (returnedHash !== workflow.proposalHash) {
          workflow.proposalSourceMismatch = true;
          workflow.proposalSourceMismatchAt = new Date().toISOString();
        }
      }
      return this._clone(workflow.proposalSnapshot);
    }
    if (!returnedProposal) {
      throw new Error('Completed DGR task did not contain an annotation ChangeSet proposal');
    }
    if (this._serializedBytes(returnedProposal) > this.runLimits.proposalBytes) {
      throw new Error(`Completed DGR annotation proposal exceeds ${this.runLimits.proposalBytes} bytes`);
    }
    const returnedHash = await this._hash(returnedProposal);
    this._assertWorkspace(workspace);
    if (workflow.reportAttachment?.proposalSha256 && returnedHash !== workflow.reportAttachment.proposalSha256) {
      throw new Error(
        `DGR annotation proposal for research task ${workflow.taskId} does not match its archived full report`
      );
    }
    workflow.proposalSnapshot = this._clone(returnedProposal);
    workflow.proposalHash = returnedHash;
    workflow.proposalCapturedAt = new Date().toISOString();
    return this._clone(workflow.proposalSnapshot);
  }

  async _validatedCurrentAnnotationReceipt(workflow, receipt, workspace) {
    const required = workflow.currentAnnotationBindingRequired === true;
    if (!required && !receipt) return null;
    if (!this._isPlainRecord(receipt)) {
      throw new Error(`DGR report ${workflow.taskId} is missing its current-annotation verification receipt`);
    }
    if (!required && receipt.verified !== true) {
      if (
        receipt.schema !== 'codexomics.dgr-current-annotation-validation.v1' ||
        receipt.required !== false ||
        receipt.snapshotSha256 !== null ||
        String(receipt.targetFeatureHash || '') !== String(workflow.target?.featureHash || '')
      ) {
        throw new Error(`DGR report ${workflow.taskId} has an invalid legacy current-annotation receipt`);
      }
      return this._clone(receipt);
    }
    if (
      receipt.schema !== 'codexomics.dgr-current-annotation-validation.v1' ||
      receipt.verified !== true ||
      !/^[a-f0-9]{64}$/i.test(String(receipt.snapshotSha256 || '')) ||
      String(receipt.targetFeatureHash || '') !== String(workflow.target?.featureHash || '')
    ) {
      throw new Error(`DGR report ${workflow.taskId} failed current-annotation binding verification`);
    }
    const expectedHash =
      workflow.currentAnnotationRequestSha256 ||
      (workflow.currentAnnotationSnapshot ? await this._hash(workflow.currentAnnotationSnapshot) : null);
    this._assertWorkspace(workspace);
    if (!expectedHash || String(receipt.snapshotSha256).toLowerCase() !== String(expectedHash).toLowerCase()) {
      throw new Error(`DGR report ${workflow.taskId} current-annotation snapshot hash does not match its workflow`);
    }
    return this._clone(receipt);
  }

  async _archiveCompletedReport(workflow, workspace) {
    if (workflow.reportAttachment) {
      await this._validatedCurrentAnnotationReceipt(
        workflow,
        workflow.reportAttachment.currentAnnotationValidation,
        workspace
      );
      const attachmentManager = this.app?.geneAttachmentsManager;
      if (attachmentManager?.ready) await attachmentManager.ready;
      if (typeof attachmentManager?.getAttachmentsForGene !== 'function') return workflow.reportAttachment;
      const registered = attachmentManager
        .getAttachmentsForGene(workflow.reportAttachment.geneId)
        .some(attachment => attachment.id === workflow.reportAttachment.attachmentId);
      if (registered) return workflow.reportAttachment;
      workflow.reportAttachment = null;
      workflow.reportArchiveRecoveryAt = new Date().toISOString();
    }
    const archiveReport = typeof window !== 'undefined' && window.electronAPI?.archiveDgrTaskResult;
    // Unit/headless contexts and older preload bridges cannot persist an
    // artifact. The production Electron bridge always provides this API.
    if (typeof archiveReport !== 'function') return null;
    const attachments = this.app?.geneAttachmentsManager;
    if (!attachments || typeof attachments.registerGeneratedAttachment !== 'function') {
      throw new Error('DGR completed, but the gene attachment store is not available to archive its full report');
    }
    const response = await archiveReport({
      taskId: workflow.taskId,
      target: this._clone(workflow.target),
      correlationId: workflow.correlationId,
      targetBindingHash: workflow.targetBindingHash,
      currentAnnotation: this._clone(workflow.currentAnnotationSnapshot),
      requireCurrentAnnotation: workflow.currentAnnotationBindingRequired === true,
    });
    this._assertWorkspace(workspace);
    if (!response?.success || !this._isPlainRecord(response.artifact)) {
      throw new Error(response?.error || 'CodeXomics could not archive the completed DGR full report');
    }
    const currentAnnotationValidation = await this._validatedCurrentAnnotationReceipt(
      workflow,
      response.artifact.currentAnnotationValidation,
      workspace
    );
    const geneId = String(
      workflow.target.locusTag || workflow.target.geneSymbol || workflow.target.proteinId || workflow.target.featureId
    );
    const attachment = await attachments.registerGeneratedAttachment(
      geneId,
      response.artifact,
      this._clone(workflow.target)
    );
    this._assertWorkspace(workspace);
    if (!attachment?.id) throw new Error('CodeXomics archived the DGR report but could not register its attachment');
    workflow.reportAttachment = {
      attachmentId: String(attachment.id),
      geneId,
      fileName: String(response.artifact.fileName || attachment.filename || ''),
      size: Number(response.artifact.size || 0),
      sha256: String(response.artifact.sha256 || ''),
      proposalSha256: String(response.artifact.proposalSha256 || ''),
      citationValidation: this._clone(response.artifact.citationValidation || null),
      currentAnnotationValidation,
      summary: this._clone(response.artifact.summary || {}),
      storedAt: response.artifact.storedAt || new Date().toISOString(),
    };
    workflow.currentAnnotationValidation = this._clone(currentAnnotationValidation);
    workflow.reportArchivedAt = new Date().toISOString();
    return workflow.reportAttachment;
  }

  async _validatedWorkflowTargetBindingHash(workflow, workspace) {
    if (!this._isPlainRecord(workflow?.target)) {
      throw new Error(`Annotation research workflow ${workflow?.taskId || 'unknown'} has an invalid bound target`);
    }
    const computedHash = await this._hash(workflow.target);
    this._assertWorkspace(workspace);
    if (workflow.targetBindingHash && workflow.targetBindingHash !== computedHash) {
      throw new Error(`Annotation research workflow ${workflow.taskId} failed target-binding verification`);
    }
    return computedHash;
  }

  async _prepareResearchDocuments(params, target) {
    const paths = Array.isArray(params.researchDocumentPaths) ? params.researchDocumentPaths : [];
    const requestedAttachmentIds = Array.isArray(params.researchAttachmentIds) ? params.researchAttachmentIds : [];
    if (paths.length > 8 || requestedAttachmentIds.length > 8 || paths.length + requestedAttachmentIds.length > 8) {
      throw new Error('Annotation research accepts at most 8 user PDF documents');
    }
    for (const [index, filePath] of paths.entries()) {
      if (typeof filePath !== 'string' || !filePath.trim() || filePath.length > 4096) {
        throw new Error(`researchDocumentPaths[${index}] must be a non-empty absolute PDF path`);
      }
    }
    for (const [index, attachmentId] of requestedAttachmentIds.entries()) {
      if (typeof attachmentId !== 'string' || !attachmentId.trim() || attachmentId.length > 256) {
        throw new Error(`researchAttachmentIds[${index}] must be a valid attachment identifier`);
      }
    }
    if (paths.length === 0 && requestedAttachmentIds.length === 0) return [];

    const electronApi = typeof window !== 'undefined' ? window.electronAPI : null;
    if (typeof electronApi?.uploadDgrResearchDocument !== 'function') {
      throw new Error('The secure DGR research document upload API is unavailable');
    }
    const attachments = this.app?.geneAttachmentsManager;
    if (attachments?.ready) await attachments.ready;
    if (!attachments || typeof attachments.getAttachmentsForGene !== 'function') {
      throw new Error('Gene attachments are required to integrate user PDFs into annotation research');
    }
    const geneId = String(target.locusTag || target.geneSymbol || target.proteinId || target.featureId);
    const existingAttachments = attachments.getAttachmentsForGene(geneId);
    const selections = [
      ...paths.map(filePath => ({ filePath: filePath.trim(), attachment: null })),
      ...requestedAttachmentIds.map(attachmentId => {
        const attachment = existingAttachments.find(item => item.id === attachmentId);
        if (!attachment) throw new Error(`Research attachment ${attachmentId} was not found for ${geneId}`);
        if (attachment.extension !== 'pdf' || !attachment.storedPath) {
          throw new Error(`Research attachment ${attachmentId} is not a stored PDF`);
        }
        return { filePath: attachment.storedPath, attachment };
      }),
    ];

    const prepared = [];
    for (const selection of selections) {
      const response = await electronApi.uploadDgrResearchDocument({ filePath: selection.filePath });
      if (!response?.success || !this._isPlainRecord(response.document)) {
        throw new Error(response?.error || `Could not upload research PDF ${selection.filePath}`);
      }
      const document = response.document;
      const attachment = selection.attachment
        ? await attachments.markResearchSourceAttachment(geneId, selection.attachment.id, document)
        : await attachments.registerResearchSourceAttachment(geneId, response.approvedPath, document);
      prepared.push({
        documentId: String(document.documentId),
        attachmentId: String(attachment.id),
        fileName: String(attachment.filename || document.name || ''),
        sha256: String(document.sha256 || ''),
        size: Number(document.size || attachment.size || 0),
      });
    }
    return Array.from(new Map(prepared.map(document => [document.documentId, document])).values());
  }

  async startAnnotationResearch(params = {}) {
    this._requireResearchPermission(params);
    return this._withRunsLock(async workspace => {
      const identifier = params.identifier || params.geneSymbol || params.gene || params.locusTag;
      if (!identifier) throw new Error('start_annotation_research requires an annotation identifier');

      const annotationService = this._annotationService();
      const resolved = await annotationService.resolveAnnotationTarget({
        identifier,
        chromosome: params.chromosome,
      });
      this._assertWorkspace(workspace);
      const target = resolved.target;
      const featureType = String(target?.featureType || '').toUpperCase();
      if (!this.supportedFeatureTypes.has(featureType)) {
        throw new Error(
          `Annotation research does not support resolved feature type "${target?.featureType || 'unknown'}"`
        );
      }
      if (!target.locusTag && !target.proteinId && !target.geneSymbol) {
        throw new Error('Annotation research requires a stable locus tag, protein identifier, or gene symbol');
      }
      const requestedGeneSymbol = String(params.geneSymbol || '').trim();
      if (
        requestedGeneSymbol &&
        target.geneSymbol &&
        requestedGeneSymbol.toLowerCase() !== String(target.geneSymbol).trim().toLowerCase()
      ) {
        throw new Error(
          `Requested research geneSymbol "${requestedGeneSymbol}" conflicts with resolved target gene "${target.geneSymbol}"`
        );
      }
      const geneSymbol = target.geneSymbol || target.locusTag || target.proteinId;
      if (!geneSymbol) throw new Error('The resolved annotation has no stable identifier for DGR research');

      const requestedOrganism = String(params.organism || '').trim();
      const targetOrganism = String(target.organism || '').trim();
      if (
        requestedOrganism &&
        targetOrganism &&
        this._normaliseOrganism(requestedOrganism) !== this._normaliseOrganism(targetOrganism)
      ) {
        throw new Error(
          `Requested organism "${requestedOrganism}" conflicts with loaded genome organism "${targetOrganism}"`
        );
      }
      const organism = targetOrganism || requestedOrganism;
      if (!organism) {
        throw new Error('start_annotation_research requires an explicit organism when genome taxonomy is unavailable');
      }
      const currentAnnotation = this._currentAnnotationSnapshot(resolved);
      const currentAnnotationRequestSha256 = await this._hash(currentAnnotation);
      this._assertWorkspace(workspace);

      const targetBindingHash = await this._hash(target);
      this._assertWorkspace(workspace);
      const repeatPolicy = String(params.repeatPolicy || 'allow').toLowerCase();
      if (!['allow', 'skip-covered'].includes(repeatPolicy)) {
        throw new Error('repeatPolicy must be either "allow" or "skip-covered"');
      }
      const researchRefreshDays = this._normaliseResearchRefreshDays(params.researchRefreshDays);
      const runs = await this._loadRuns(workspace);
      if (repeatPolicy === 'skip-covered') {
        const matchingCoverage = Object.values(runs)
          .filter(workflow => workflow && this._researchTargetsOverlap(workflow.target, target))
          .map(workflow => ({ workflow, summary: this._workflowCoverageSummary(workflow) }))
          .filter(
            item =>
              item.summary.coverageState === 'active' ||
              item.summary.coverageState === 'completed_unarchived' ||
              this._isFreshCompletedCoverage(item.summary, researchRefreshDays)
          )
          .sort(
            (left, right) =>
              (({ completed: 3, active: 2, completed_unarchived: 1 })[right.summary.coverageState] || 0) -
                ({ completed: 3, active: 2, completed_unarchived: 1 }[left.summary.coverageState] || 0) ||
              Date.parse(right.summary.completedAt || right.summary.updatedAt || right.summary.createdAt || 0) -
                Date.parse(left.summary.completedAt || left.summary.updatedAt || left.summary.createdAt || 0)
          )[0];
        if (matchingCoverage?.summary.coverageState === 'completed') {
          return {
            success: true,
            duplicate: true,
            skipped: true,
            researchDisposition: 'already_covered',
            coverage: matchingCoverage.summary,
            workflow: this._clone(matchingCoverage.workflow),
          };
        }
        if (matchingCoverage?.summary.coverageState === 'active') {
          return {
            success: true,
            duplicate: true,
            resumed: true,
            researchDisposition: 'resume_active',
            coverage: matchingCoverage.summary,
            workflow: this._clone(matchingCoverage.workflow),
          };
        }
        if (matchingCoverage?.summary.coverageState === 'completed_unarchived') {
          return {
            success: true,
            duplicate: true,
            resumed: true,
            researchDisposition: 'resume_incomplete_archive',
            coverage: matchingCoverage.summary,
            workflow: this._clone(matchingCoverage.workflow),
          };
        }
      }

      const manager = this._manager();
      if (typeof manager.ensureServerConnected === 'function') {
        await manager.ensureServerConnected('deep-gene-research');
      } else if (!manager.activeServers?.has('deep-gene-research')) {
        await manager.connectToServer('deep-gene-research');
      }
      this._assertWorkspace(workspace);

      const researchDocuments = await this._prepareResearchDocuments(params, target);
      this._assertWorkspace(workspace);

      const intentHash = await this._hash({
        organism: this._normaliseOrganism(organism),
        geneSymbol: String(geneSymbol).trim().toLowerCase(),
        researchFocus: params.researchFocus || [],
        specificAspects: params.specificAspects || [],
        diseaseContext: params.diseaseContext || null,
        experimentalApproach: params.experimentalApproach || null,
        userPrompt: params.userPrompt || null,
        language: params.language || null,
        maxResult: params.maxResult ?? null,
        literatureBudget: params.literatureBudget ?? null,
        fullTextBudget: params.fullTextBudget ?? null,
        forceRefresh: params.forceRefresh === true,
        researchDocumentIds: researchDocuments.map(document => document.documentId),
        currentAnnotation,
      });
      this._assertWorkspace(workspace);
      const idempotencyKey = params.idempotencyKey || `research:${target.genomeId}:${targetBindingHash}:${intentHash}`;
      if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 256) {
        throw new Error('Research idempotencyKey must be a non-empty string of at most 256 characters');
      }
      const initiatedBy = params.__executionContext?.principal || 'codexomics-chatbox-workflow';
      const persistedGeneSymbol = this._boundedPersistedString(String(geneSymbol), 'Research gene symbol', 128);
      const persistedOrganism = this._boundedPersistedString(String(organism), 'Research organism', 256);
      const persistedInitiatedBy = this._boundedPersistedString(String(initiatedBy), 'Research initiator', 512);
      const correlationId = params.correlationId || `curation:${target.featureId}:${Date.now()}`;
      this._boundedPersistedString(correlationId, 'Research correlationId', 256);
      const existingForKey = Object.values(runs).find(workflow => workflow?.idempotencyKey === idempotencyKey);
      if (existingForKey) {
        const existingTargetBindingHash = await this._validatedWorkflowTargetBindingHash(existingForKey, workspace);
        if (existingForKey.intentHash !== intentHash || existingTargetBindingHash !== targetBindingHash) {
          throw new Error(`Research idempotency key ${idempotencyKey} was already used for a different bound request`);
        }
        return { success: true, duplicate: true, workflow: existingForKey };
      }
      const provisionalWorkflow = {
        status: '\u0800'.repeat(64),
        target,
        geneSymbol: persistedGeneSymbol,
        organism: persistedOrganism,
        idempotencyKey,
        intentHash,
        targetBindingHash,
        correlationId,
        initiatedBy: persistedInitiatedBy,
        currentAnnotationSnapshot: this._clone(currentAnnotation),
        currentAnnotationRequestSha256,
        currentAnnotationBindingRequired: true,
        researchDocuments: researchDocuments.map(document => ({
          documentId: document.documentId,
          attachmentId: document.attachmentId,
          fileName: document.fileName,
          sha256: document.sha256,
          size: document.size,
        })),
        createdAt: new Date().toISOString(),
        changeSetId: null,
      };
      this._assertCanStartRun(runs, persistedInitiatedBy, provisionalWorkflow);
      const result = await manager.executeToolOnServer('deep-gene-research', 'deep-gene-research', {
        geneSymbol: persistedGeneSymbol,
        organism: persistedOrganism,
        researchFocus: params.researchFocus || [],
        specificAspects: params.specificAspects || [],
        diseaseContext: params.diseaseContext,
        experimentalApproach: params.experimentalApproach,
        userPrompt: params.userPrompt,
        language: params.language,
        maxResult: params.maxResult,
        literatureBudget: params.literatureBudget,
        fullTextBudget: params.fullTextBudget,
        forceRefresh: params.forceRefresh === true,
        userDocumentIds: researchDocuments.map(document => document.documentId),
        enableCitationImage: false,
        includeCodeXomicsAnnotationProposal: true,
        target,
        currentAnnotation,
        idempotencyKey,
        correlationId,
      });
      this._assertWorkspace(workspace);
      if (typeof result?.taskId !== 'string' || !result.taskId.trim()) {
        throw new Error('DGR did not return a structured research task ID');
      }
      if (result.taskId.length > this.runLimits.taskIdLength) {
        throw new Error(`DGR research task ID exceeds ${this.runLimits.taskIdLength} characters`);
      }

      const existingRun = this._runMapGet(runs, result.taskId);
      if (existingRun) {
        const existingTargetBindingHash = await this._validatedWorkflowTargetBindingHash(existingRun, workspace);
        if (
          existingRun.idempotencyKey !== idempotencyKey ||
          existingRun.intentHash !== intentHash ||
          existingTargetBindingHash !== targetBindingHash
        ) {
          throw new Error(`DGR task ID ${result.taskId} collides with a different genome research workflow`);
        }
        return {
          success: true,
          duplicate: true,
          workflow: existingRun,
          taskUrl: result.taskUrl,
          progressUrl: result.progressUrl,
        };
      }
      const workflow = this._runMapSet(runs, result.taskId, {
        ...provisionalWorkflow,
        taskId: result.taskId,
        status: this._initialRunStatus(result.status),
      });
      await this._saveRuns(runs, workspace);
      return { success: true, workflow, taskUrl: result.taskUrl, progressUrl: result.progressUrl };
    });
  }

  async getAnnotationResearchWorkflow(params = {}) {
    this._requireResearchPermission(params);
    return this._withRunsLock(async workspace => {
      const taskId = params.taskId || params.id;
      if (!taskId) throw new Error('get_annotation_research_workflow requires a taskId');
      const runs = await this._loadRuns(workspace);
      const workflow = this._runMapGet(runs, taskId);
      if (!workflow) throw new Error(`Research workflow ${taskId} is not associated with this genome`);
      await this._validatedWorkflowTargetBindingHash(workflow, workspace);
      const status = await this._manager().checkTaskStatus('deep-gene-research', taskId);
      this._assertWorkspace(workspace);
      if (!status || typeof status !== 'object' || typeof status.status !== 'string') {
        throw new Error(`Deep Gene Research returned an invalid status payload for task ${taskId}`);
      }
      workflow.status = this._initialRunStatus(status.status);
      workflow.progress = Number.isFinite(Number(status.progress))
        ? Math.max(0, Math.min(100, Number(status.progress)))
        : null;
      workflow.step = this._optionalRemoteString(status.step, 256);
      workflow.eventSeq = Number.isInteger(status.eventSeq) && status.eventSeq >= 0 ? status.eventSeq : null;
      workflow.updatedAt = new Date().toISOString();
      workflow.error = this._optionalRemoteString(status.error, 2048);

      // Project the DGR coverage/synthesis/note artifacts onto the durable
      // workflow so external agents (and the Skills runner) can read them
      // without re-fetching the full task result. Only overwrite when the
      // remote status actually carries a result; intermediate polls must not
      // wipe already-persisted values.
      const remoteResult = this._isPlainRecord(status.result) ? status.result : null;
      if (remoteResult) {
        workflow.literatureCoverage = this._clone(
          remoteResult?.metadata?.searchDiagnostics?.literatureCoverage ?? null
        );
        workflow.llmSynthesis = this._clone(remoteResult?.metadata?.llmSynthesis ?? null);
        workflow.annotationNote = this._clone(remoteResult?.annotationNote ?? null);
      }

      // Persist the authoritative remote status before local archival or
      // proposal materialization. Those post-processing steps can fail even
      // though DGR itself completed successfully, and a retry must not leave
      // the durable workflow looking indefinitely in progress.
      this._runMapSet(runs, taskId, workflow);
      await this._saveRuns(runs, workspace);

      if (status.status === 'completed' && !workflow.reportAttachment) {
        try {
          await this._archiveCompletedReport(workflow, workspace);
          delete workflow.reportArchiveError;
          delete workflow.reportArchiveErrorAt;
          this._runMapSet(runs, taskId, workflow);
          await this._saveRuns(runs, workspace);
        } catch (error) {
          workflow.reportArchiveError = this._optionalRemoteString(error?.message || String(error), 2048);
          workflow.reportArchiveErrorAt = new Date().toISOString();
          this._runMapSet(runs, taskId, workflow);
          await this._saveRuns(runs, workspace);
          throw error;
        }
      }

      if (status.status === 'completed' && !workflow.changeSetId && !workflow.proposalHandledAt) {
        try {
          const proposal = await this._boundCompletedProposal(workflow, status, workspace);
          workflow.proposalStatus = proposal.status || 'unknown';
          if (['draft_requires_evidence', 'draft_requires_target'].includes(proposal.status)) {
            workflow.changeSetStatus = 'not_created';
            workflow.proposalReason =
              proposal.status === 'draft_requires_evidence'
                ? 'Deep Gene Research completed, but found no evidence-backed claims that are safe to propose.'
                : 'Deep Gene Research completed, but could not bind its proposal to the exact genome target.';
            workflow.proposalHandledAt = new Date().toISOString();
          } else if (!this._canProposeAnnotation(params)) {
            workflow.proposalStatus = proposal.status || 'ready_for_validation';
            workflow.proposalAvailable = true;
            workflow.changeSetStatus = 'requires_annotation_propose';
            workflow.proposalReason =
              'Research completed successfully. An authenticated annotation:propose caller must materialize the reviewed proposal as a ChangeSet.';
          } else {
            const changeSet = await this._annotationService().createAnnotationChangeset({
              identifier: workflow.target.locusTag || workflow.target.geneSymbol || workflow.target.proteinId,
              chromosome: workflow.target.chromosome,
              baseRevision: workflow.target.annotationRevision,
              annotationProposal: proposal,
              evidence:
                proposal.evidence || proposal.evidenceManifest?.sourceRecords?.map(record => record.label) || [],
              researchRun: taskId,
              idempotencyKey: `changeset:${workflow.idempotencyKey}`,
              principal: workflow.initiatedBy || 'codexomics-chatbox-workflow',
              __executionContext: params.__executionContext,
            });
            this._assertWorkspace(workspace);
            workflow.changeSetId = changeSet.changeSet.id;
            workflow.changeSetStatus = changeSet.changeSet.status;
            workflow.proposalAvailable = true;
            workflow.proposalReason = null;
            workflow.proposalHandledAt = new Date().toISOString();
          }
          delete workflow.proposalMaterializationError;
          delete workflow.proposalMaterializationErrorAt;
        } catch (error) {
          workflow.proposalAvailable = Boolean(workflow.proposalSnapshot || status.result?.annotationProposal);
          workflow.changeSetStatus = 'validation_failed';
          workflow.proposalReason = this._optionalRemoteString(error?.message || String(error), 2048);
          workflow.proposalMaterializationError = workflow.proposalReason;
          workflow.proposalMaterializationErrorAt = new Date().toISOString();
          this._runMapSet(runs, taskId, workflow);
          await this._saveRuns(runs, workspace);
          throw error;
        }
      }
      this._runMapSet(runs, taskId, workflow);
      await this._saveRuns(runs, workspace);
      let result = status.result && typeof status.result === 'object' ? this._clone(status.result) : null;
      if (workflow.proposalSnapshot) {
        if (!result || Array.isArray(result)) result = {};
        result.annotationProposal = this._clone(workflow.proposalSnapshot);
      }
      return { success: true, workflow, result };
    });
  }

  async archiveAnnotationResearch(params = {}) {
    this._requireResearchPermission(params);
    return this._withRunsLock(async workspace => {
      const taskId = String(params.taskId || params.id || '').trim();
      const correlationId = String(params.correlationId || '').trim();
      const identifier = params.identifier || params.geneSymbol || params.gene || params.locusTag;
      if (!taskId || taskId.length > this.runLimits.taskIdLength || !/^[A-Za-z0-9._:-]+$/.test(taskId)) {
        throw new Error('archive_annotation_research requires a valid DGR taskId');
      }
      if (!correlationId || correlationId.length > 256) {
        throw new Error('archive_annotation_research requires the DGR correlationId');
      }
      if (!identifier) throw new Error('archive_annotation_research requires an annotation identifier');

      const resolved = await this._annotationService().resolveAnnotationTarget({
        identifier,
        chromosome: params.chromosome,
      });
      this._assertWorkspace(workspace);
      const target = resolved.target;
      const featureType = String(target?.featureType || '').toUpperCase();
      if (
        !this.supportedFeatureTypes.has(featureType) ||
        (!target.locusTag && !target.proteinId && !target.geneSymbol)
      ) {
        throw new Error('External DGR reports require a supported, stable resolved gene annotation target');
      }
      const currentAnnotation = this._currentAnnotationSnapshot(resolved);
      const currentAnnotationRequestSha256 = await this._hash(currentAnnotation);
      this._assertWorkspace(workspace);
      const targetBindingHash = await this._hash(target);
      this._assertWorkspace(workspace);
      const runs = await this._loadRuns(workspace);
      let workflow = this._runMapGet(runs, taskId);
      if (workflow) {
        const existingTargetHash = await this._validatedWorkflowTargetBindingHash(workflow, workspace);
        if (existingTargetHash !== targetBindingHash || workflow.correlationId !== correlationId) {
          throw new Error(`DGR task ${taskId} is already bound to a different annotation research workflow`);
        }
        if (
          workflow.currentAnnotationRequestSha256 &&
          workflow.currentAnnotationRequestSha256 !== currentAnnotationRequestSha256
        ) {
          throw new Error(`DGR task ${taskId} is already bound to a different current annotation snapshot`);
        }
        workflow.currentAnnotationSnapshot ||= this._clone(currentAnnotation);
        workflow.currentAnnotationRequestSha256 ||= currentAnnotationRequestSha256;
        workflow.currentAnnotationBindingRequired = true;
      } else {
        const initiatedBy = this._boundedPersistedString(
          String(params.__executionContext?.principal || 'external-dgr-agent'),
          'Research initiator',
          512
        );
        workflow = {
          taskId,
          status: 'completed',
          target: this._clone(target),
          geneSymbol: this._boundedPersistedString(
            String(target.geneSymbol || target.locusTag || target.proteinId),
            'Research gene symbol',
            128
          ),
          organism: this._boundedPersistedString(
            String(target.organism || params.organism || 'unknown organism'),
            'Research organism',
            256
          ),
          idempotencyKey: `external-archive:${taskId}`,
          intentHash: `external:${taskId}`,
          targetBindingHash,
          correlationId,
          initiatedBy,
          currentAnnotationSnapshot: this._clone(currentAnnotation),
          currentAnnotationRequestSha256,
          currentAnnotationBindingRequired: true,
          createdAt: new Date().toISOString(),
          externalTask: true,
          changeSetId: null,
        };
        this._assertCanStartRun(runs, initiatedBy, workflow);
      }
      const reportAttachment = await this._archiveCompletedReport(workflow, workspace);
      if (!reportAttachment) {
        throw new Error('The Electron report archive bridge is unavailable');
      }
      workflow.status = 'completed';
      workflow.updatedAt = new Date().toISOString();
      workflow.externalArchiveCompletedAt ||= workflow.updatedAt;
      this._runMapSet(runs, taskId, workflow);
      await this._saveRuns(runs, workspace);
      return {
        success: true,
        taskId,
        reportAttachment: this._clone(reportAttachment),
      };
    });
  }

  async cancelAnnotationResearch(params = {}) {
    this._requireResearchPermission(params);
    return this._withRunsLock(async workspace => {
      const taskId = params.taskId || params.id;
      if (!taskId) throw new Error('cancel_annotation_research requires a taskId');
      const runs = await this._loadRuns(workspace);
      const workflow = this._runMapGet(runs, taskId);
      if (!workflow) throw new Error(`Research workflow ${taskId} is not associated with this genome`);
      await this._validatedWorkflowTargetBindingHash(workflow, workspace);
      const result = await this._manager().executeToolOnServer('deep-gene-research', 'cancel-research-run', { taskId });
      this._assertWorkspace(workspace);
      workflow.status = this._initialRunStatus(result.status || 'cancel_requested');
      workflow.updatedAt = new Date().toISOString();
      this._runMapSet(runs, taskId, workflow);
      await this._saveRuns(runs, workspace);
      return { success: true, taskId, status: workflow.status };
    });
  }
}

if (typeof window !== 'undefined') {
  window.AnnotationResearchWorkflowService = AnnotationResearchWorkflowService;
}
