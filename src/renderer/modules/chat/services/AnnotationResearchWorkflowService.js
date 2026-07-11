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
  }

  _genomePath() {
    return this.app?.currentFile?.path || this.app?.fileManager?.currentFile?.path || null;
  }

  async _loadRuns() {
    const path = this._genomePath();
    if (path && this.app?.sidecarManager) {
      const runs = await this.app.sidecarManager.get(path, 'annotationResearchRuns');
      return runs && typeof runs === 'object' ? runs : {};
    }
    return Object.fromEntries(this.memoryRuns);
  }

  async _saveRuns(runs) {
    const path = this._genomePath();
    this.memoryRuns = new Map(Object.entries(runs));
    if (path && this.app?.sidecarManager) {
      await this.app.sidecarManager.set(path, 'annotationResearchRuns', runs);
      await this.app.sidecarManager.forceSave(path);
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

  async startAnnotationResearch(params = {}) {
    const identifier = params.identifier || params.geneSymbol || params.gene || params.locusTag;
    const organism = String(params.organism || '').trim();
    if (!identifier) throw new Error('start_annotation_research requires an annotation identifier');
    if (!organism) throw new Error('start_annotation_research requires an explicit organism; it is never guessed');

    const annotationService = this._annotationService();
    const resolved = await annotationService.resolveAnnotationTarget({
      identifier,
      chromosome: params.chromosome,
    });
    const target = resolved.target;
    const geneSymbol = params.geneSymbol || target.geneSymbol || target.locusTag;
    if (!geneSymbol) throw new Error('The resolved annotation has no gene symbol or locus tag for DGR research');

    const idempotencyKey = params.idempotencyKey || `research:${target.featureId}:${target.annotationRevision}`;
    const result = await this._manager().executeToolOnServer('deep-gene-research', 'deep-gene-research', {
      geneSymbol,
      organism,
      researchFocus: params.researchFocus || [],
      specificAspects: params.specificAspects || [],
      userPrompt: params.userPrompt,
      language: params.language,
      maxResult: params.maxResult,
      includeCodeXomicsAnnotationProposal: true,
      target,
      idempotencyKey,
      correlationId: params.correlationId || `curation:${target.featureId}:${Date.now()}`,
    });
    if (!result?.taskId) throw new Error('DGR did not return a structured research task ID');

    const runs = await this._loadRuns();
    runs[result.taskId] = {
      taskId: result.taskId,
      status: result.status,
      target,
      geneSymbol,
      organism,
      idempotencyKey,
      correlationId: result.correlationId || params.correlationId || null,
      createdAt: new Date().toISOString(),
      changeSetId: null,
    };
    await this._saveRuns(runs);
    return { success: true, workflow: runs[result.taskId], taskUrl: result.taskUrl, progressUrl: result.progressUrl };
  }

  async getAnnotationResearchWorkflow(params = {}) {
    const taskId = params.taskId || params.id;
    if (!taskId) throw new Error('get_annotation_research_workflow requires a taskId');
    const runs = await this._loadRuns();
    const workflow = runs[taskId];
    if (!workflow) throw new Error(`Research workflow ${taskId} is not associated with this genome`);
    const status = await this._manager().checkTaskStatus('deep-gene-research', taskId);
    workflow.status = status.status;
    workflow.progress = status.progress;
    workflow.step = status.step;
    workflow.eventSeq = status.eventSeq;
    workflow.updatedAt = new Date().toISOString();
    workflow.error = status.error || null;

    if (status.status === 'completed' && !workflow.changeSetId) {
      const proposal = status.result?.annotationProposal;
      if (!proposal) throw new Error('Completed DGR task did not contain an annotation ChangeSet proposal');
      const changeSet = await this._annotationService().createAnnotationChangeset({
        identifier: workflow.target.locusTag || workflow.target.geneSymbol || workflow.target.proteinId,
        chromosome: workflow.target.chromosome,
        baseRevision: workflow.target.annotationRevision,
        annotationProposal: proposal,
        evidence: proposal.evidence || proposal.evidenceManifest?.sourceRecords?.map(record => record.label) || [],
        researchRun: taskId,
        manifestHash: proposal.evidenceManifest?.sourceRecords?.map(record => record.sourceHash).join(':') || null,
        idempotencyKey: `changeset:${workflow.idempotencyKey}`,
        principal: 'codexomics-chatbox-workflow',
      });
      workflow.changeSetId = changeSet.changeSet.id;
      workflow.changeSetStatus = changeSet.changeSet.status;
    }
    runs[taskId] = workflow;
    await this._saveRuns(runs);
    return { success: true, workflow, result: status.result || null };
  }

  async cancelAnnotationResearch(params = {}) {
    const taskId = params.taskId || params.id;
    if (!taskId) throw new Error('cancel_annotation_research requires a taskId');
    const result = await this._manager().executeToolOnServer('deep-gene-research', 'cancel-research-run', { taskId });
    const runs = await this._loadRuns();
    if (runs[taskId]) {
      runs[taskId].status = result.status || 'cancel_requested';
      runs[taskId].updatedAt = new Date().toISOString();
      await this._saveRuns(runs);
    }
    return { success: true, taskId, status: result.status || 'cancel_requested' };
  }
}

if (typeof window !== 'undefined') {
  window.AnnotationResearchWorkflowService = AnnotationResearchWorkflowService;
}
