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
    workflow.proposalSnapshot = this._clone(returnedProposal);
    workflow.proposalHash = await this._hash(workflow.proposalSnapshot);
    this._assertWorkspace(workspace);
    workflow.proposalCapturedAt = new Date().toISOString();
    return this._clone(workflow.proposalSnapshot);
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
      const geneSymbol = target.geneSymbol || target.locusTag;
      if (!geneSymbol) throw new Error('The resolved annotation has no gene symbol or locus tag for DGR research');

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

      const manager = this._manager();
      if (typeof manager.ensureServerConnected === 'function') {
        await manager.ensureServerConnected('deep-gene-research');
      } else if (!manager.activeServers?.has('deep-gene-research')) {
        await manager.connectToServer('deep-gene-research');
      }
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
      });
      this._assertWorkspace(workspace);
      const targetBindingHash = await this._hash(target);
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
      const runs = await this._loadRuns(workspace);
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
        enableCitationImage: false,
        includeCodeXomicsAnnotationProposal: true,
        target,
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

      if (status.status === 'completed' && !workflow.changeSetId && !workflow.proposalHandledAt) {
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
            evidence: proposal.evidence || proposal.evidenceManifest?.sourceRecords?.map(record => record.label) || [],
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
