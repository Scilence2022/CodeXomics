/**
 * AnnotationReviewManager
 *
 * Human review UI for immutable annotation ChangeSets. The manager never edits
 * genome annotations directly: it delegates approval and commit to
 * AnnotationChangeSetService so the durable ledger, target hashes, revision
 * checks, evidence requirements, and separation-of-duties rules remain the
 * authority for every single or batch action.
 */
class AnnotationReviewManager {
  constructor(app) {
    this.app = app;
    this.configManager = app?.configManager || null;
    this.changeSets = new Map();
    this.appliedGeneGroups = new Map();
    this.expandedAppliedGeneKeys = new Set();
    this.duplicateTargetCounts = new Map();
    this.approvalTokens = new Map();
    this.activeDecisionSession = null;
    this.activeChangeSetId = null;
    this.isLoading = false;
    this.isActing = false;
    this.detailRequestId = 0;
    this.defaults = Object.freeze({
      curatorIdentity: 'local-curator',
      approvalExpiryMinutes: 30,
      batchSizeLimit: 50,
      batchReviewEnabled: true,
    });
    this.badgeWatchIntervalMs = 60000;
    this.isBadgeRefreshing = false;
    this.isAppliedLoading = false;
    this.settings = this._loadSettings();
    this.app.localCuratorIdentity = this.settings.curatorIdentity;
    this.app.confirmAnnotationChangeSet = request => this.confirmAnnotationChangeSet(request);
    this._bindStaticEvents();
    this._startPendingBadgeWatch();
  }

  _annotationService() {
    const service = this.app?.chatManager?.services?.annotation;
    if (!service) throw new Error('Annotation review service is not available');
    return service;
  }

  _loadSettings() {
    const saved = this.configManager?.get('generalSettings.annotationGovernance', {}) || {};
    return {
      curatorIdentity: String(saved.curatorIdentity || this.defaults.curatorIdentity).trim(),
      approvalExpiryMinutes: this._boundedNumber(
        saved.approvalExpiryMinutes,
        1,
        1440,
        this.defaults.approvalExpiryMinutes
      ),
      batchSizeLimit: this._boundedNumber(saved.batchSizeLimit, 1, 200, this.defaults.batchSizeLimit),
      batchReviewEnabled: saved.batchReviewEnabled !== false,
    };
  }

  _boundedNumber(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.round(number))) : fallback;
  }

  _bindStaticEvents() {
    const bind = (id, event, handler) => {
      const element = document.getElementById(id);
      const bindingKey = `annotationReview${event[0].toUpperCase()}${event.slice(1)}Bound`;
      if (element && !element.dataset[bindingKey]) {
        // Surface handler failures instead of letting an exception kill the click silently.
        element.addEventListener(event, eventObject => {
          try {
            const result = handler(eventObject);
            if (result && typeof result.catch === 'function') {
              result.catch(error => this._reportHandlerError(id, error));
            }
          } catch (error) {
            this._reportHandlerError(id, error);
          }
        });
        element.dataset[bindingKey] = 'true';
      }
    };
    bind('annotationReviewHeaderBtn', 'click', () => this.showReviewCenter());
    bind('annotationReviewRefreshBtn', 'click', () => this.refreshQueue());
    bind('annotationReviewFilter', 'change', () => this.refreshQueue());
    bind('annotationReviewRiskFilter', 'change', () => this.refreshQueue());
    bind('annotationReviewSearch', 'input', () => this._debouncedRefresh());
    bind('annotationReviewSelectAll', 'change', event => this.toggleSelectAll(event.target.checked));
    bind('annotationReviewApproveBtn', 'click', () => this.approveSelected(false));
    bind('annotationReviewApproveApplyBtn', 'click', () => this.approveSelected(true));
    bind('annotationReviewRejectBtn', 'click', () => this.rejectSelected());
    bind('annotationReviewArchiveBtn', 'click', () => this.archiveSelected(true));
    bind('annotationReviewRestoreBtn', 'click', () => this.archiveSelected(false));
    bind('annotationReviewDeleteBtn', 'click', () => this.deleteSelected());
    bind('annotationReviewArchiveFilter', 'change', () => this.refreshQueue());
    bind('annotationAppliedShowArchived', 'change', () => this.refreshAppliedGenes());
    bind('annotationGovernanceSaveBtn', 'click', () => this.saveGovernanceSettings());
    bind('annotationAppliedRefreshBtn', 'click', () => this.refreshAppliedGenes());
    bind('annotationAppliedSort', 'change', () => this.refreshAppliedGenes());
    bind('annotationAppliedSearch', 'input', () => this._debouncedAppliedRefresh());
    bind('annotationAppliedGenes', 'click', event => this._handleAppliedClick(event));
    bind('annotationAppliedGenes', 'keydown', event => this._handleAppliedKeydown(event));
    bind('annotationReviewQueue', 'click', event => this._handleQueueClick(event));
    bind('annotationReviewQueue', 'keydown', event => this._handleQueueKeydown(event));
    bind('annotationReviewQueue', 'change', event => this._handleQueueChange(event));
    bind('annotationReviewDetail', 'click', event => this._handleQueueClick(event));

    document.querySelectorAll('#annotationReviewModal .annotation-review-nav-btn').forEach(button => {
      if (button.dataset.annotationReviewBound) return;
      button.addEventListener('click', () => this.showModalTab(button.dataset.reviewTab));
      button.dataset.annotationReviewBound = 'true';
    });
  }

  _debouncedRefresh() {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.refreshQueue(), 250);
  }

  _debouncedAppliedRefresh() {
    clearTimeout(this.appliedRefreshTimer);
    this.appliedRefreshTimer = setTimeout(() => this.refreshAppliedGenes(), 250);
  }

  showReviewCenter(options = {}) {
    const modal = document.getElementById('annotationReviewModal');
    if (!modal) {
      this._notify('Annotation Review is not available.', 'error');
      return;
    }
    this._bindStaticEvents();
    this._populateGovernanceForm();
    modal.classList.add('show');
    this._initializeModalBehavior();
    this.showModalTab(options.tab || 'queue');
    // Reading the ledger costs more than a frame, and starting it in the click
    // handler holds back the paint that shows the modal, so the button feels
    // dead. Show the spinner first and let the queue load on the next frame.
    this._renderQueueLoading();
    const loadQueue = () => void this.refreshQueue({ focusChangeSetId: options.changeSetId || null });
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(loadQueue);
    else loadQueue();
  }

  _renderQueueLoading() {
    const queue = document.getElementById('annotationReviewQueue');
    if (queue) {
      queue.innerHTML =
        '<div class="annotation-review-loading"><i class="fas fa-spinner fa-spin"></i> Loading ChangeSets…</div>';
    }
  }

  _initializeModalBehavior() {
    const modal = document.getElementById('annotationReviewModal');
    const modalContent = modal?.querySelector('.modal-content.annotation-review-modal');
    if (!modal || !modalContent) return;

    if (!modal.dataset.annotationReviewModalInitialized) {
      if (!window.modalDragManager || !window.resizableModalManager) {
        clearTimeout(this.modalBehaviorTimer);
        this.modalBehaviorTimer = setTimeout(() => this._initializeModalBehavior(), 100);
        return;
      }
      window.modalDragManager.makeDraggable('#annotationReviewModal');
      window.resizableModalManager.makeResizable('#annotationReviewModal');
      const resetButton = modal.querySelector('.reset-position-btn');
      resetButton?.addEventListener('click', event => {
        event.stopPropagation();
        window.resizableModalManager.resetSize('#annotationReviewModal');
        window.modalDragManager.resetPosition('#annotationReviewModal');
        window.resizableModalManager.makeResizable('#annotationReviewModal');
      });
      modal.dataset.annotationReviewModalInitialized = 'true';
    }
  }

  showModalTab(tabName = 'queue') {
    if (!['queue', 'applied', 'governance'].includes(tabName)) tabName = 'queue';
    document.querySelectorAll('#annotationReviewModal .annotation-review-nav-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.reviewTab === tabName);
      button.setAttribute('aria-selected', String(button.dataset.reviewTab === tabName));
    });
    document.querySelectorAll('#annotationReviewModal .annotation-review-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.reviewPanel === tabName);
    });
    // The applied list reads the same ledger as the queue, so it is loaded on
    // demand rather than kept in sync with every queue refresh.
    if (tabName === 'applied') void this.refreshAppliedGenes();
  }

  _isAppliedTabActive() {
    return Boolean(
      document.querySelector('#annotationReviewModal .annotation-review-panel[data-review-panel="applied"].active')
    );
  }

  /**
   * List every gene whose annotation ChangeSets were applied to the genome.
   * Committed ChangeSets are grouped per target so a gene curated several
   * times reads as one entry with its full applied history.
   */
  async refreshAppliedGenes() {
    const list = document.getElementById('annotationAppliedGenes');
    if (!list) return;
    if (this.isAppliedLoading) {
      this.pendingAppliedRefresh = true;
      return;
    }
    this.isAppliedLoading = true;
    list.innerHTML =
      '<div class="annotation-review-loading"><i class="fas fa-spinner fa-spin"></i> Loading annotated genes…</div>';
    try {
      const query = document.getElementById('annotationAppliedSearch')?.value || '';
      const result = await this._annotationService().listAnnotationChangesets({
        statuses: ['committed'],
        includeArchived: document.getElementById('annotationAppliedShowArchived')?.checked === true,
        query,
        limit: 1000,
      });
      const groups = this._groupAppliedChangeSets(result.changeSets || []);
      this.appliedGeneGroups = new Map(groups.map(group => [group.key, group]));
      // Keep only the expansions that survived the reload, otherwise a stale
      // key would silently re-expand a different gene later.
      this.expandedAppliedGeneKeys = new Set(
        Array.from(this.expandedAppliedGeneKeys).filter(key => this.appliedGeneGroups.has(key))
      );
      this._renderAppliedGenes(this._sortAppliedGroups(groups));
      this._updateAppliedCount(result.statusCounts || {});
    } catch (error) {
      list.innerHTML = `<div class="annotation-review-empty error"><i class="fas fa-exclamation-triangle"></i><p>${this._escape(error.message)}</p></div>`;
    } finally {
      this.isAppliedLoading = false;
      if (this.pendingAppliedRefresh) {
        this.pendingAppliedRefresh = false;
        await this.refreshAppliedGenes();
      }
    }
  }

  _groupAppliedChangeSets(changeSets) {
    const groups = new Map();
    for (const changeSet of changeSets) {
      const key = this._targetKey(changeSet) || changeSet.id;
      const target = changeSet.target || {};
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          label: target.geneSymbol || target.locusTag || target.proteinId || target.featureId || 'Unknown target',
          geneSymbol: target.geneSymbol || null,
          locusTag: target.locusTag || null,
          chromosome: target.chromosome || null,
          featureType: target.featureType || null,
          coordinates: target.coordinates || null,
          changeSets: [],
          fields: [],
          curators: [],
          lastAppliedAt: null,
          latestRevision: null,
        };
        groups.set(key, group);
      }
      group.changeSets.push(changeSet);
      for (const field of changeSet.fields || []) {
        if (!group.fields.includes(field)) group.fields.push(field);
      }
      if (changeSet.committedBy && !group.curators.includes(changeSet.committedBy)) {
        group.curators.push(changeSet.committedBy);
      }
      const appliedAt = Date.parse(changeSet.committedAt || '');
      if (Number.isFinite(appliedAt) && (!group.lastAppliedAt || appliedAt > group.lastAppliedAt)) {
        group.lastAppliedAt = appliedAt;
      }
      if (Number.isInteger(changeSet.resultingRevision)) {
        group.latestRevision = Math.max(group.latestRevision ?? 0, changeSet.resultingRevision);
      }
      // Coordinates and identifiers are only present on targets recorded by a
      // recent service version; take them from whichever record carries them.
      group.coordinates = group.coordinates || target.coordinates || null;
      group.chromosome = group.chromosome || target.chromosome || null;
      group.featureType = group.featureType || target.featureType || null;
    }
    for (const group of groups.values()) {
      group.changeSets.sort((left, right) => Date.parse(right.committedAt || 0) - Date.parse(left.committedAt || 0));
    }
    return Array.from(groups.values());
  }

  _sortAppliedGroups(groups) {
    const mode = document.getElementById('annotationAppliedSort')?.value || 'recent';
    const sorted = groups.slice();
    if (mode === 'gene') {
      sorted.sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
    } else if (mode === 'count') {
      sorted.sort(
        (left, right) =>
          right.changeSets.length - left.changeSets.length || (right.lastAppliedAt || 0) - (left.lastAppliedAt || 0)
      );
    } else {
      sorted.sort((left, right) => (right.lastAppliedAt || 0) - (left.lastAppliedAt || 0));
    }
    return sorted;
  }

  _renderAppliedGenes(groups) {
    const list = document.getElementById('annotationAppliedGenes');
    const total = document.getElementById('annotationAppliedTotal');
    const appliedChangeSets = groups.reduce((count, group) => count + group.changeSets.length, 0);
    if (total) {
      total.textContent = `${groups.length} gene${groups.length === 1 ? '' : 's'} · ${appliedChangeSets} applied ChangeSet${appliedChangeSets === 1 ? '' : 's'}`;
    }
    if (!list) return;
    if (groups.length === 0) {
      list.innerHTML = `
        <div class="annotation-review-empty">
          <i class="fas fa-dna"></i>
          <p>No annotations have been applied yet.</p>
          <small>Genes appear here once an approved ChangeSet is committed to the genome.</small>
        </div>`;
      return;
    }
    list.innerHTML = groups.map(group => this._renderAppliedGeneItem(group)).join('');
  }

  _renderAppliedGeneItem(group) {
    const expanded = this.expandedAppliedGeneKeys.has(group.key);
    const locus = group.locusTag && group.locusTag !== group.label ? group.locusTag : '';
    const coordinates = group.coordinates || {};
    const hasLocation = this._hasTargetLocation(group);
    const location = hasLocation
      ? `${group.chromosome}:${Number(coordinates.start).toLocaleString()}–${Number(coordinates.end).toLocaleString()}${coordinates.strand === -1 ? ' (−)' : coordinates.strand === 1 ? ' (+)' : ''}`
      : group.chromosome || '';
    const fields = group.fields
      .slice(0, 8)
      .map(field => `<span class="annotation-applied-field">${this._escape(this._fieldLabel(field))}</span>`)
      .join('');
    const omittedFields = group.fields.length - Math.min(group.fields.length, 8);
    return `
      <article class="annotation-applied-item${expanded ? ' is-expanded' : ''}" data-applied-key="${this._escape(group.key)}">
        <div class="annotation-applied-main" role="button" tabindex="0" data-action="applied-toggle"
          aria-expanded="${expanded ? 'true' : 'false'}"
          aria-label="Applied annotation history for ${this._escape(group.label)}">
          <div class="annotation-review-item-heading">
            <div>
              <i class="fas fa-chevron-${expanded ? 'down' : 'right'} annotation-applied-caret" aria-hidden="true"></i>
              <strong>${this._escape(group.label)}</strong>
              ${locus ? `<span class="annotation-review-locus">${this._escape(locus)}</span>` : ''}
              <span class="annotation-review-feature">${this._escape(group.featureType || '')}</span>
            </div>
            <div class="annotation-review-badges">
              <span class="annotation-review-status status-committed">${group.changeSets.length} applied</span>
            </div>
          </div>
          <div class="annotation-review-meta">
            <span><i class="fas fa-clock"></i> ${this._escape(group.lastAppliedAt ? this._formatDate(group.lastAppliedAt) : 'Unknown time')}</span>
            <span><i class="fas fa-user-check"></i> ${this._escape(group.curators.join(', ') || 'unknown curator')}</span>
            ${Number.isInteger(group.latestRevision) ? `<span><i class="fas fa-code-branch"></i> Revision ${group.latestRevision}</span>` : ''}
            ${location ? `<span><i class="fas fa-map-marker-alt"></i> ${this._escape(location)}</span>` : ''}
          </div>
          ${fields ? `<div class="annotation-applied-fields">${fields}${omittedFields > 0 ? `<span class="annotation-applied-field is-muted">+${omittedFields} more</span>` : ''}</div>` : ''}
        </div>
        <div class="annotation-applied-actions">
          <button class="btn btn-sm btn-secondary" data-action="applied-locate" data-applied-key="${this._escape(group.key)}"
            ${hasLocation ? '' : 'disabled title="This ChangeSet target has no recorded coordinates"'}>
            <i class="fas fa-crosshairs"></i> Go to gene
          </button>
        </div>
        <div class="annotation-applied-history" ${expanded ? '' : 'hidden'}>
          ${expanded ? group.changeSets.map(changeSet => this._renderAppliedRecord(changeSet)).join('') : ''}
        </div>
      </article>`;
  }

  _renderAppliedRecord(changeSet) {
    const changes = (changeSet.preview || [])
      .map(
        item =>
          `<div class="annotation-applied-change"><label>${this._escape(this._fieldLabel(item.field))}</label><span>${this._escape(this._compactValue(item.after, 160))}</span></div>`
      )
      .join('');
    return `
      <div class="annotation-applied-record">
        <div class="annotation-applied-record-heading">
          <code>${this._escape(changeSet.id)}</code>
          <span><i class="fas fa-clock"></i> ${this._escape(changeSet.committedAt ? this._formatDate(changeSet.committedAt) : 'Unknown time')}</span>
        </div>
        <div class="annotation-review-meta">
          <span><i class="fas fa-list-check"></i> ${changeSet.operationCount} changes</span>
          <span><i class="fas fa-book"></i> ${changeSet.evidenceCount} evidence records</span>
          <span><i class="fas fa-robot"></i> proposed by ${this._escape(changeSet.createdBy || 'unknown')}</span>
          <span><i class="fas fa-user-check"></i> applied by ${this._escape(changeSet.committedBy || 'unknown')}</span>
          <span class="annotation-review-risk risk-${this._escape(changeSet.riskLevel || 'unknown')}">${this._escape(changeSet.riskLevel || 'unknown')} risk</span>
        </div>
        ${changes ? `<div class="annotation-applied-changes">${changes}</div>` : ''}
        ${changeSet.reportAttachment ? `<div class="annotation-review-report-link"><i class="fas fa-paperclip"></i> Archived report: <code>${this._escape(changeSet.reportAttachment)}</code></div>` : ''}
        <button class="btn btn-sm btn-secondary annotation-applied-record-btn" data-action="applied-open-record" data-id="${this._escape(changeSet.id)}">
          <i class="fas fa-clipboard-list"></i> Open audit record
        </button>
      </div>`;
  }

  async _handleAppliedClick(event) {
    const actionElement = event.target.closest('[data-action]');
    const action = actionElement?.dataset.action;
    if (action === 'applied-locate') {
      event.stopPropagation();
      this.locateAppliedGene(actionElement.dataset.appliedKey);
      return;
    }
    if (action === 'applied-open-record') {
      event.stopPropagation();
      await this.openAppliedRecord(actionElement.dataset.id);
      return;
    }
    const item = event.target.closest('.annotation-applied-item[data-applied-key]');
    if (item && !event.target.closest('button, a, input, select, textarea, summary')) {
      this.toggleAppliedGene(item.dataset.appliedKey);
    }
  }

  _handleAppliedKeydown(event) {
    if (!['Enter', ' '].includes(event.key)) return;
    const main = event.target.closest('.annotation-applied-main[role="button"]');
    if (!main || event.target !== main) return;
    const item = main.closest('.annotation-applied-item[data-applied-key]');
    if (!item) return;
    event.preventDefault();
    this.toggleAppliedGene(item.dataset.appliedKey);
  }

  toggleAppliedGene(key) {
    const group = this.appliedGeneGroups.get(key);
    if (!group) return;
    if (this.expandedAppliedGeneKeys.has(key)) this.expandedAppliedGeneKeys.delete(key);
    else this.expandedAppliedGeneKeys.add(key);
    const item = this._appliedGeneNode(key);
    if (!item) return;
    item.outerHTML = this._renderAppliedGeneItem(group);
    this._appliedGeneNode(key)?.querySelector('.annotation-applied-main')?.focus();
  }

  _appliedGeneNode(key) {
    return Array.from(document.querySelectorAll('.annotation-applied-item[data-applied-key]')).find(
      node => node.dataset.appliedKey === key
    );
  }

  /**
   * Move the genome view to the applied gene. Committed targets record the
   * coordinates as they were at commit time, so a missing or unresolvable
   * location is reported instead of silently doing nothing.
   */
  _hasTargetLocation(group) {
    const coordinates = group?.coordinates;
    return Boolean(
      group?.chromosome &&
      coordinates?.start != null &&
      coordinates?.end != null &&
      Number.isFinite(Number(coordinates.start)) &&
      Number.isFinite(Number(coordinates.end)) &&
      Number(coordinates.start) >= 1 &&
      Number(coordinates.end) >= Number(coordinates.start)
    );
  }

  locateAppliedGene(key) {
    const group = this.appliedGeneGroups.get(key);
    const coordinates = group?.coordinates || {};
    if (!this._hasTargetLocation(group)) {
      this._notify('This ChangeSet target has no recorded coordinates to navigate to.', 'warning');
      return;
    }
    const navigate = this.app?.navigationManager?.navigateToPosition;
    if (typeof navigate !== 'function') {
      this._notify('Genome navigation is not available.', 'error');
      return;
    }
    const result = this.app.navigationManager.navigateToPosition(
      group.chromosome,
      Number(coordinates.start),
      Number(coordinates.end ?? coordinates.start)
    );
    if (result && result.success === false) {
      this._notify(result.error || 'Unable to navigate to this gene.', 'error');
      return;
    }
    document.getElementById('annotationReviewModal')?.classList.remove('show');
    this._notify(`Navigated to ${group.label}.`, 'success');
  }

  /** Show the full audit record of an applied ChangeSet in the review queue. */
  async openAppliedRecord(changeSetId) {
    const filter = document.getElementById('annotationReviewFilter');
    if (filter && filter.value !== 'committed' && filter.value !== 'all') filter.value = 'committed';
    const search = document.getElementById('annotationReviewSearch');
    // Query the ID so an older record cannot fall outside the first page.
    if (search) search.value = changeSetId;
    const risk = document.getElementById('annotationReviewRiskFilter');
    if (risk) risk.value = '';
    const archiveFilter = document.getElementById('annotationReviewArchiveFilter');
    if (archiveFilter) archiveFilter.value = 'all';
    this.showModalTab('queue');
    await this.refreshQueue({ focusChangeSetId: changeSetId });
  }

  _updateAppliedCount(statusCounts) {
    const applied = Number(statusCounts.committed || 0);
    document.querySelectorAll('.annotation-review-applied-count').forEach(badge => {
      badge.textContent = applied > 999 ? '999+' : String(applied);
      badge.hidden = applied === 0;
    });
  }

  async refreshQueue(options = {}) {
    if (this.isLoading) {
      this.pendingQueueRefresh = { ...this.pendingQueueRefresh, ...options };
      return;
    }
    const queue = document.getElementById('annotationReviewQueue');
    if (!queue) return;
    this.isLoading = true;
    this._renderQueueLoading();
    this._updateActionState();
    try {
      const status = document.getElementById('annotationReviewFilter')?.value || 'active';
      const riskLevel = document.getElementById('annotationReviewRiskFilter')?.value || '';
      const query = document.getElementById('annotationReviewSearch')?.value || '';
      const archiveFilter = document.getElementById('annotationReviewArchiveFilter')?.value || 'visible';
      const statuses = status === 'active' ? ['awaiting_approval', 'approved'] : status === 'all' ? [] : [status];
      const result = await this._annotationService().listAnnotationChangesets({
        statuses,
        includeArchived: archiveFilter !== 'visible',
        archivedOnly: archiveFilter === 'archived',
        riskLevels: riskLevel ? [riskLevel] : [],
        query,
        limit: 1000,
      });
      this.changeSets = new Map((result.changeSets || []).map(changeSet => [changeSet.id, changeSet]));
      this._closeDetachedDetail();
      this._renderQueue(result);
      this._updatePendingBadge(result.statusCounts || {});
      this._updateAppliedCount(result.statusCounts || {});
      const focusId = options.focusChangeSetId || this.activeChangeSetId;
      if (focusId && this.changeSets.has(focusId)) await this.viewChangeSet(focusId);
    } catch (error) {
      this.changeSets.clear();
      this._closeDetachedDetail();
      queue.innerHTML = `<div class="annotation-review-empty error"><i class="fas fa-exclamation-triangle"></i><p>${this._escape(error.message)}</p></div>`;
    } finally {
      this.isLoading = false;
      this._updateActionState();
      if (this.pendingQueueRefresh) {
        const pending = this.pendingQueueRefresh;
        this.pendingQueueRefresh = null;
        await this.refreshQueue(pending);
      }
    }
  }

  _renderQueue(result) {
    const queue = document.getElementById('annotationReviewQueue');
    const total = document.getElementById('annotationReviewTotal');
    if (total) total.textContent = `${result.total || 0} ChangeSet${result.total === 1 ? '' : 's'}`;
    if (!queue) return;
    const changeSets = result.changeSets || [];
    this.duplicateTargetCounts = changeSets
      .filter(changeSet => !changeSet.archivedAt && ['awaiting_approval', 'approved'].includes(changeSet.status))
      .reduce((counts, changeSet) => {
        const key = this._targetKey(changeSet);
        if (key) counts.set(key, (counts.get(key) || 0) + 1);
        return counts;
      }, new Map());
    if (changeSets.length === 0) {
      queue.innerHTML = `
        <div class="annotation-review-empty">
          <i class="fas fa-clipboard-check"></i>
          <p>No ChangeSets match the current filters.</p>
          <small>Agent proposals appear here after they are validated and stored in the genome sidecar.</small>
        </div>`;
      this._updateActionState();
      return;
    }
    queue.innerHTML = changeSets.map(changeSet => this._renderQueueItem(changeSet)).join('');
    this._updateActionState();
  }

  _renderQueueItem(changeSet) {
    const target = changeSet.target || {};
    const label = target.geneSymbol || target.locusTag || target.proteinId || target.featureId || 'Unknown target';
    const locus = target.locusTag && target.locusTag !== label ? target.locusTag : '';
    const statusEligible = !changeSet.archivedAt && ['awaiting_approval', 'approved'].includes(changeSet.status);
    const selectedIdentityConflict = statusEligible && this.settings.curatorIdentity === changeSet.createdBy;
    const readOnlyReason = this._selectionReadOnlyReason(changeSet, selectedIdentityConflict);
    const duplicateTargetConflict =
      statusEligible && (this.duplicateTargetCounts.get(this._targetKey(changeSet)) || 0) > 1;
    const preview = (changeSet.preview || [])
      .slice(0, 3)
      .map(
        item =>
          `<span>${this._escape(this._fieldLabel(item.field))}: ${this._escape(this._compactValue(item.after, 80))}</span>`
      )
      .join('');
    return `
      <article class="annotation-review-item${this.activeChangeSetId === changeSet.id ? ' is-active' : ''}"
        data-changeset-id="${this._escape(changeSet.id)}">
        <label class="annotation-review-select" title="Select this ChangeSet for review, archive, or restore">
          <input type="checkbox" class="annotation-review-checkbox" value="${this._escape(changeSet.id)}"
            aria-label="Select ${this._escape(label)} ChangeSet">
        </label>
        <div class="annotation-review-item-main" role="button" tabindex="0"
          aria-label="Review details for ${this._escape(label)}"
          aria-controls="annotationReviewDetail"
          aria-expanded="${this.activeChangeSetId === changeSet.id ? 'true' : 'false'}">
          <div class="annotation-review-item-heading">
            <div>
              <strong>${this._escape(label)}</strong>
              ${locus ? `<span class="annotation-review-locus">${this._escape(locus)}</span>` : ''}
              <span class="annotation-review-feature">${this._escape(target.featureType || '')}</span>
            </div>
            <div class="annotation-review-badges">
              ${changeSet.archivedAt ? '<span class="annotation-review-status status-archived">Archived</span>' : ''}
              <span class="annotation-review-status status-${this._escape(changeSet.status)}">${this._escape(this._statusLabel(changeSet.status))}</span>
              <span class="annotation-review-risk risk-${this._escape(changeSet.riskLevel || 'unknown')}">${this._escape(changeSet.riskLevel || 'unknown')} risk</span>
            </div>
          </div>
          <div class="annotation-review-meta">
            <span><i class="fas fa-list-check"></i> ${changeSet.operationCount} changes</span>
            <span><i class="fas fa-book"></i> ${changeSet.evidenceCount} evidence records</span>
            <span><i class="fas fa-user-robot"></i> ${this._escape(changeSet.createdBy || 'unknown')}</span>
            <span><i class="fas fa-clock"></i> ${this._escape(this._formatDate(changeSet.createdAt))}</span>
          </div>
          ${preview ? `<div class="annotation-review-preview-lines">${preview}</div>` : ''}
          ${selectedIdentityConflict ? '<div class="annotation-review-warning"><i class="fas fa-user-shield"></i> Reviewer identity matches the creator. Choose a distinct curator identity in Governance.</div>' : ''}
          ${!statusEligible ? `<div class="annotation-review-read-only-message"><i class="fas fa-lock"></i> ${this._escape(readOnlyReason)}</div>` : ''}
          ${duplicateTargetConflict ? '<div class="annotation-review-warning"><i class="fas fa-code-branch"></i> Multiple active ChangeSets target this CDS. Compare them and select only one for approval.</div>' : ''}
        </div>
        <button class="btn btn-sm annotation-review-details-btn" data-action="details" data-id="${this._escape(changeSet.id)}">
          Review
        </button>
      </article>`;
  }

  _selectionReadOnlyReason(changeSet, identityConflict = false) {
    if (identityConflict) {
      return 'The configured curator identity matches the ChangeSet creator. Choose a distinct reviewer in Governance.';
    }
    if (changeSet.archivedAt) {
      return 'Archived. Restore this record before review; previous approvals are not restored.';
    }
    const reasons = {
      committed: 'Already applied. This audit record is read-only.',
      stale: 'Stale because the target annotation changed. Create a fresh ChangeSet before review.',
      rejected: 'Already rejected. This audit record is read-only.',
    };
    return reasons[changeSet.status] || `Status ${changeSet.status || 'unknown'} is not eligible for review.`;
  }

  async viewChangeSet(changeSetId) {
    const detail = document.getElementById('annotationReviewDetail');
    if (!detail) return;
    const requestId = ++this.detailRequestId;
    const genomePath = this.app.loadedGenomePath;
    const annotations = this.app.currentAnnotations;
    this._setActiveChangeSet(changeSetId);
    detail.innerHTML =
      '<div class="annotation-review-loading"><i class="fas fa-spinner fa-spin"></i> Loading full proposal…</div>';
    try {
      const result = await this._annotationService().getAnnotationChangeset({ changeSetId });
      if (
        requestId !== this.detailRequestId ||
        this.activeChangeSetId !== changeSetId ||
        genomePath !== this.app.loadedGenomePath ||
        annotations !== this.app.currentAnnotations
      ) {
        return;
      }
      const changeSet = result.changeSet;
      const summary = this.changeSets.get(changeSetId) || {};
      detail.innerHTML = this._renderChangeSetDetail(changeSet, summary);
      detail.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      if (requestId === this.detailRequestId && this.activeChangeSetId === changeSetId) {
        detail.innerHTML = `<div class="annotation-review-empty error"><p>${this._escape(error.message)}</p></div>`;
      }
    }
  }

  /**
   * Drop the detail pane once the ChangeSet it describes has left the queue.
   * Approving, applying, or rejecting moves a ChangeSet out of the review
   * filter, and the pane used to keep presenting the decided proposal — with
   * its action buttons — next to an empty queue.
   */
  _closeDetachedDetail() {
    if (!this.activeChangeSetId || this.changeSets.has(this.activeChangeSetId)) return;
    const detail = document.getElementById('annotationReviewDetail');
    if (detail) detail.innerHTML = '';
    this.detailRequestId += 1;
    this._setActiveChangeSet(null);
  }

  _renderChangeSetDetail(changeSet, summary) {
    const target = changeSet.target || {};
    const previewByField = new Map((summary.preview || []).map(item => [`${item.op}:${item.field}`, item]));
    const operations = (changeSet.operations || [])
      .map((operation, index) => {
        const preview = previewByField.get(`${operation.op}:${operation.field}`) || {};
        return `
          <div class="annotation-review-operation">
            <div class="annotation-review-operation-heading">
              <span class="operation-index">${index + 1}</span>
              <strong>${this._escape(this._fieldLabel(operation.field))}</strong>
              <code>${this._escape(operation.op)}</code>
            </div>
            <div class="annotation-review-diff">
              <div><label>Current</label><pre>${this._escape(this._displayValue(preview.before))}</pre></div>
              <div><label>Proposed</label><pre>${this._escape(this._displayValue(operation.value))}</pre></div>
            </div>
            ${(operation.claimIds || []).length ? `<small>Claims: ${operation.claimIds.map(id => this._escape(id)).join(', ')}</small>` : ''}
          </div>`;
      })
      .join('');
    const evidence = (changeSet.evidence || [])
      .map(item => `<li>${this._escape(typeof item === 'string' ? item : JSON.stringify(item))}</li>`)
      .join('');
    const reportMetadata =
      changeSet.proposalMetadata?.archivedDgrReport || changeSet.proposalMetadata?.reportAttachment || null;
    const attachment = reportMetadata?.attachmentId || summary.reportAttachment;
    const fullTextSourceCount = Number(reportMetadata?.summary?.fullTextSourceCount || 0);
    const fullTextFindingCount = Number(reportMetadata?.summary?.fullTextFindingCount || 0);
    const verifiedFullTextSourceCount = Number(reportMetadata?.citationValidation?.verifiedFullTextSourceCount || 0);
    return `
      <div class="annotation-review-detail-header">
        <div>
          <h4>${this._escape(target.geneSymbol || target.locusTag || 'Annotation ChangeSet')}</h4>
          <code>${this._escape(changeSet.id)}</code>
        </div>
        <button class="annotation-review-detail-close" data-action="close-details" title="Close details">&times;</button>
      </div>
      <div class="annotation-review-detail-summary">
        <span>Target: ${this._escape(target.locusTag || target.featureId || '')}</span>
        <span>Chromosome: ${this._escape(target.chromosome || '')}</span>
        <span>Revision: ${this._escape(changeSet.baseRevision)}</span>
        <span>Risk: ${this._escape(changeSet.riskLevel || '')}</span>
        <span>Creator: ${this._escape(changeSet.createdBy || '')}</span>
        <span>Status: ${this._escape(this._statusLabel(changeSet.status))}${changeSet.archivedAt ? ' · Archived' : ''}</span>
      </div>
      ${
        attachment
          ? `<div class="annotation-review-report-link"><i class="fas fa-paperclip"></i> Archived report: <code>${this._escape(attachment)}</code>
              <button type="button" class="gene-review-report-open" data-action="open-report" data-task-id="${this._escape(
                changeSet.researchRun || reportMetadata?.taskId || ''
              )}" style="margin-left:8px;padding:4px 10px;border:1px solid #90CAF9;background:#e3f2fd;color:#1565C0;border-radius:6px;cursor:pointer;font-weight:600;" title="Open the archived research report">View research report</button>${
                fullTextSourceCount > 0
                  ? ` <span>Full text: ${verifiedFullTextSourceCount}/${fullTextSourceCount} evidence-linked sources, ${fullTextFindingCount} findings</span>`
                  : ''
              }</div>`
          : ''
      }
      ${changeSet.rejectionReason ? `<p class="annotation-review-warning">Rejection reason: ${this._escape(changeSet.rejectionReason)}</p>` : ''}
      <div class="annotation-review-detail-actions">
        <button type="button" class="btn btn-secondary" data-action="${changeSet.archivedAt ? 'restore' : 'archive'}" data-id="${this._escape(changeSet.id)}" ${this.isActing ? 'disabled' : ''}>
          <i class="fas fa-${changeSet.archivedAt ? 'rotate-left' : 'archive'}"></i> ${changeSet.archivedAt ? 'Restore record' : 'Archive record'}
        </button>
        ${changeSet.status === 'committed' ? `<button type="button" class="btn btn-secondary" data-action="rollback" data-id="${this._escape(changeSet.id)}" ${this.isActing ? 'disabled' : ''}><i class="fas fa-undo"></i> Propose rollback</button>` : ''}
        <button type="button" class="btn btn-danger" data-action="delete" data-id="${this._escape(changeSet.id)}" ${this.isActing || !this._isDeletable(changeSet) ? 'disabled' : ''} title="${this._isDeletable(changeSet) ? 'Permanently delete this unapplied proposal' : 'Applied records are required to restore annotations. Archive instead.'}">
          <i class="fas fa-trash"></i> Delete
        </button>
        <small>Archiving hides the record and preserves its history. A rollback requires approval before it changes annotations.</small>
      </div>
      <div class="annotation-review-operations">${operations}</div>
      <details class="annotation-review-evidence" ${evidence ? '' : 'hidden'}>
        <summary>Evidence (${changeSet.evidence?.length || 0})</summary>
        <ul>${evidence}</ul>
      </details>`;
  }

  async _handleQueueClick(event) {
    const button = event.target.closest('[data-action]');
    if (button?.disabled) return;
    if (['archive', 'restore'].includes(button?.dataset.action)) {
      const changeSet = this.changeSets.get(button.dataset.id);
      if (changeSet) await this.archiveSelected(button.dataset.action === 'archive', [changeSet]);
      return;
    }
    if (button?.dataset.action === 'delete') {
      const changeSet = this.changeSets.get(button.dataset.id);
      if (changeSet) await this.deleteSelected([changeSet]);
      return;
    }
    if (button?.dataset.action === 'rollback') {
      await this.proposeRollback(button.dataset.id);
      return;
    }
    if (button?.dataset.action === 'open-report') {
      const taskId = String(button.dataset.taskId || '').trim();
      const reader = window.electronAPI?.readDgrReportAttachment;
      if (!reader || !taskId) {
        this._notify('Research report is not available for this ChangeSet.', 'error');
        return;
      }
      reader(this.app?.loadedGenomePath || '', taskId)
        .then(result => {
          if (result?.success && result.reportMarkdown) this._showResearchReportModal(result);
          else this._notify(result?.error || 'Research report is not available for this ChangeSet.', 'error');
        })
        .catch(error => this._notify(`Failed to read research report: ${error?.message || error}`, 'error'));
      return;
    }
    if (button?.dataset.action === 'details') {
      await this.viewChangeSet(button.dataset.id);
      return;
    }
    if (button?.dataset.action === 'close-details') {
      const activeItem = document.querySelector(
        '#annotationReviewQueue .annotation-review-item.is-active .annotation-review-item-main'
      );
      const detail = document.getElementById('annotationReviewDetail');
      if (detail) detail.innerHTML = '';
      this.detailRequestId += 1;
      this._setActiveChangeSet(null);
      activeItem?.focus();
      return;
    }

    const item = event.target.closest('.annotation-review-item[data-changeset-id]');
    const interactiveControl = event.target.closest('input, label, button, a, select, textarea, summary');
    if (item && !interactiveControl) void this.viewChangeSet(item.dataset.changesetId);
  }

  _showResearchReportModal(result) {
    this._closeResearchReportModal();
    const overlay = document.createElement('div');
    overlay.id = 'dgrReportOverlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:24px;';
    const panel = document.createElement('div');
    panel.style.cssText =
      'background:#fff;color:#1c2733;border-radius:10px;max-width:1100px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.35);';
    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border-bottom:1px solid #dfe5ec;';
    header.innerHTML =
      `<div><strong>${this._escape(result.title || 'Deep Gene Research Report')}</strong>` +
      `<div style="font-size:12px;color:#64748b">DGR-${this._escape(result.taskId)} · ${this._escape(
        result.filename || ''
      )} · sha256 ${this._escape(String(result.sha256 || '').slice(0, 12))}…</div></div>`;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.style.cssText =
      'border:1px solid #cbd5e1;background:#f1f5f9;border-radius:6px;padding:6px 12px;cursor:pointer;';
    close.onclick = () => this._closeResearchReportModal();
    header.appendChild(close);
    const body = document.createElement('pre');
    body.style.cssText =
      'flex:1;overflow:auto;padding:18px;margin:0;white-space:pre-wrap;word-break:break-word;font:13px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;';
    body.textContent = result.reportMarkdown || '(No markdown body in the archived report.)';
    panel.appendChild(header);
    panel.appendChild(body);
    overlay.appendChild(panel);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) this._closeResearchReportModal();
    });
    document.body.appendChild(overlay);
    if (!this._boundReportEsc) {
      this._boundReportEsc = event => {
        if (event.key === 'Escape') this._closeResearchReportModal();
      };
      document.addEventListener('keydown', this._boundReportEsc);
    }
  }

  _closeResearchReportModal() {
    const overlay = document.getElementById('dgrReportOverlay');
    if (overlay) overlay.remove();
    if (this._boundReportEsc) {
      document.removeEventListener('keydown', this._boundReportEsc);
      this._boundReportEsc = null;
    }
  }

  _handleQueueKeydown(event) {
    if (!['Enter', ' '].includes(event.key)) return;
    const itemMain = event.target.closest('.annotation-review-item-main[role="button"]');
    if (!itemMain || event.target !== itemMain) return;
    const item = itemMain.closest('.annotation-review-item[data-changeset-id]');
    if (!item) return;
    event.preventDefault();
    void this.viewChangeSet(item.dataset.changesetId);
  }

  _setActiveChangeSet(changeSetId) {
    this.activeChangeSetId = changeSetId || null;
    document.querySelectorAll('#annotationReviewQueue .annotation-review-item').forEach(item => {
      const isActive = item.dataset.changesetId === this.activeChangeSetId;
      item.classList.toggle('is-active', isActive);
      item.querySelector('.annotation-review-item-main')?.setAttribute('aria-expanded', String(isActive));
    });
  }

  _handleQueueChange(event) {
    if (!event.target.classList.contains('annotation-review-checkbox')) return;
    this._updateActionState();
  }

  toggleSelectAll(checked) {
    if (this.isActing || this.isLoading) return;
    const limit = this._selectionLimit();
    document
      .querySelectorAll('#annotationReviewQueue .annotation-review-checkbox:not(:disabled)')
      .forEach((input, index) => {
        input.checked = checked && index < limit;
      });
    this._updateActionState();
  }

  _selectedChangeSets() {
    return Array.from(document.querySelectorAll('#annotationReviewQueue .annotation-review-checkbox:checked'))
      .map(input => this.changeSets.get(input.value))
      .filter(Boolean);
  }

  _isReviewable(changeSet) {
    return !changeSet.archivedAt && ['awaiting_approval', 'approved'].includes(changeSet.status);
  }

  _isDeletable(changeSet) {
    return (
      ['awaiting_approval', 'approved', 'rejected', 'stale'].includes(changeSet.status) && !changeSet.commitReceipt
    );
  }

  _selectionLimit() {
    return this.settings.batchReviewEnabled ? this.settings.batchSizeLimit : 1;
  }

  _batchSelectionReason(selected) {
    if (!selected.length) return 'Choose at least one record.';
    if (!this.settings.batchReviewEnabled && selected.length > 1) {
      return 'Batch review is disabled in Governance settings. Choose one record or enable batch review.';
    }
    if (selected.length > this.settings.batchSizeLimit) {
      return `Select no more than ${this.settings.batchSizeLimit} ChangeSets per batch, or raise the limit in Governance.`;
    }
    return '';
  }

  _updateActionState() {
    const selected = this._selectedChangeSets();
    const count = document.getElementById('annotationReviewSelectedCount');
    if (count) count.textContent = `${selected.length} selected`;
    const selectionReason = this._batchSelectionReason(selected);
    const busyReason = this.isActing ? 'A review action is in progress.' : this.isLoading ? 'Loading records…' : '';
    const commonReason = busyReason || selectionReason;
    const reviewReason =
      commonReason ||
      (selected.some(changeSet => !this._isReviewable(changeSet))
        ? 'Choose only unarchived awaiting-review or approved records to approve or reject.'
        : '');
    const duplicateTargets = this._duplicateTargets(selected);
    const approvalReason =
      reviewReason ||
      (selected.some(changeSet => changeSet.createdBy === this.settings.curatorIdentity)
        ? 'Choose a reviewer identity different from the proposal creator in Governance.'
        : '') ||
      (duplicateTargets.length
        ? `Approve: choose only one proposal per target. Conflicting targets: ${duplicateTargets.join(', ')}.`
        : '');
    const actions = {
      annotationReviewDeleteBtn:
        commonReason ||
        (selected.some(changeSet => !this._isDeletable(changeSet))
          ? 'Applied records are required to restore annotations. Choose only unapplied proposals to delete, or archive instead.'
          : ''),
      annotationReviewApproveBtn: approvalReason,
      annotationReviewApproveApplyBtn: approvalReason,
      annotationReviewRejectBtn: reviewReason,
      annotationReviewArchiveBtn:
        commonReason ||
        (selected.some(changeSet => changeSet.archivedAt) ? 'Choose only unarchived records to archive.' : ''),
      annotationReviewRestoreBtn:
        commonReason ||
        (selected.some(changeSet => !changeSet.archivedAt) ? 'Choose only archived records to restore.' : ''),
    };
    for (const [id, reason] of Object.entries(actions)) {
      const button = document.getElementById(id);
      if (button) {
        button.disabled = Boolean(reason);
        button.title = reason;
        if (reason) button.setAttribute('aria-description', reason);
        else button.removeAttribute('aria-description');
      }
    }
    const eligible = document.querySelectorAll('#annotationReviewQueue .annotation-review-checkbox:not(:disabled)');
    const limit = this._selectionLimit();
    const hint = document.getElementById('annotationReviewActionHint');
    if (hint) {
      const messages = [];
      if (selected.length && (commonReason || approvalReason)) messages.push(commonReason || approvalReason);
      if (eligible.length > limit && !selectionReason) {
        messages.push(`Select all chooses up to ${limit} records. Review the remaining records in another batch.`);
      }
      hint.textContent = messages.join(' ');
      hint.hidden = !messages.length;
    }
    document
      .querySelectorAll(
        '#annotationReviewDetail [data-action="archive"], #annotationReviewDetail [data-action="restore"], #annotationReviewDetail [data-action="rollback"]'
      )
      .forEach(button => {
        button.disabled = this.isActing;
      });
    document.querySelectorAll('#annotationReviewDetail [data-action="delete"]').forEach(button => {
      const record = this.changeSets.get(button.dataset.id);
      button.disabled = this.isActing || this.isLoading || !record || !this._isDeletable(record);
    });
    const selectAll = document.getElementById('annotationReviewSelectAll');
    if (selectAll) {
      const checked = document.querySelectorAll('#annotationReviewQueue .annotation-review-checkbox:checked');
      const eligibleLabel = document.getElementById('annotationReviewEligibleLabel');
      if (eligibleLabel) {
        eligibleLabel.textContent =
          eligible.length > limit ? `${limit} of ${eligible.length} selectable` : `${eligible.length} selectable`;
      }
      selectAll.disabled = this.isActing || this.isLoading || eligible.length === 0;
      const selectionSize = Math.min(limit, eligible.length);
      selectAll.checked = selectionSize > 0 && checked.length === selectionSize;
      selectAll.indeterminate = checked.length > 0 && checked.length !== selectionSize;
      const selectAllDescription = `Select up to ${limit} visible records. Available actions depend on their status.`;
      selectAll.setAttribute('aria-label', selectAllDescription);
      const label = document.getElementById('annotationReviewSelectAllLabel');
      if (label) label.title = selectAllDescription;
    }
  }

  _validateBatch(selected, reviewOnly = false) {
    if (!selected.length) return false;
    const reason = this._batchSelectionReason(selected);
    if (reason) {
      this._notify(reason, 'warning');
      return false;
    }
    if (reviewOnly && selected.some(changeSet => !this._isReviewable(changeSet))) {
      this._notify('Select only unarchived awaiting-review or approved ChangeSets for this action.', 'warning');
      return false;
    }
    return true;
  }

  async _runReviewAction(operation) {
    if (this.isActing || this.isLoading) return;
    this.isActing = true;
    this.actionWorkspace = { path: this.app.loadedGenomePath, annotations: this.app.currentAnnotations };
    this._updateActionState();
    try {
      return await operation();
    } finally {
      this.activeDecisionSession = null;
      this.isActing = false;
      this.actionWorkspace = null;
      this._updateActionState();
    }
  }

  _assertReviewWorkspace() {
    const workspace = this.actionWorkspace;
    if (
      workspace &&
      (workspace.path !== this.app.loadedGenomePath || workspace.annotations !== this.app.currentAnnotations)
    ) {
      throw new Error('The loaded genome workspace changed during review; retry the action');
    }
  }

  async approveSelected(applyAfterApproval = false) {
    return this._runReviewAction(() => this._approveSelected(applyAfterApproval));
  }

  async _approveSelected(applyAfterApproval = false) {
    const selectedChangeSets = this._selectedChangeSets();
    if (!this._validateBatch(selectedChangeSets, true)) return;
    const selected = selectedChangeSets;
    if (selected.length === 0) return;
    const duplicateTargets = this._duplicateTargets(selected);
    if (duplicateTargets.length > 0) {
      this._notify(
        `Select only one ChangeSet per target before approval. Conflicting targets: ${duplicateTargets.join(', ')}.`,
        'error'
      );
      return;
    }
    const conflicts = selected.filter(changeSet => changeSet.createdBy === this.settings.curatorIdentity);
    if (conflicts.length > 0) {
      this._notify('The reviewer identity must be different from every selected ChangeSet creator.', 'error');
      this.showModalTab('governance');
      return;
    }
    const verb = applyAfterApproval ? 'approve and apply' : 'approve';
    if (!window.confirm(this._batchConfirmationText(selected, verb))) return;

    this._startDecisionSession('approve', selected);
    const results = [];
    try {
      for (const changeSet of selected) {
        try {
          this._assertReviewWorkspace();
          let approvalToken =
            changeSet.status === 'approved' &&
            Date.parse(changeSet.approval?.expiresAt || '') > Date.now() &&
            !changeSet.approval?.revokedAt &&
            changeSet.approval?.approver === this.settings.curatorIdentity
              ? this.approvalTokens.get(changeSet.id)
              : null;
          if (!approvalToken) {
            const approved = await this._annotationService().requestAnnotationApproval({
              changeSetId: changeSet.id,
              expiresInMinutes: this.settings.approvalExpiryMinutes,
            });
            approvalToken = approved.approvalToken;
            this.approvalTokens.set(changeSet.id, approvalToken);
          }
          let applied = null;
          if (applyAfterApproval) {
            try {
              this._assertReviewWorkspace();
              applied = await this._annotationService().applyAnnotationChangeset({
                changeSetId: changeSet.id,
                approvalToken,
              });
            } finally {
              this.approvalTokens.delete(changeSet.id);
            }
          }
          results.push({ id: changeSet.id, success: true, applied: Boolean(applied?.applied) });
        } catch (error) {
          results.push({ id: changeSet.id, success: false, error: error.message });
        }
      }
    } finally {
      this.activeDecisionSession = null;
    }
    this._reportBatchResults(results, applyAfterApproval ? 'applied' : 'approved');
    await this.refreshQueue();
    if (applyAfterApproval) await this.refreshAppliedGenes();
    this._refreshSelectedGene();
  }

  async rejectSelected() {
    return this._runReviewAction(() => this._rejectSelected());
  }

  async _rejectSelected() {
    const selected = this._selectedChangeSets();
    if (!this._validateBatch(selected, true)) return;
    const reason = await this._promptForRejectionReason(selected);
    if (!reason) return;
    this._startDecisionSession('reject', selected);
    const results = [];
    try {
      for (const changeSet of selected) {
        try {
          this._assertReviewWorkspace();
          await this._annotationService().rejectAnnotationChangeset({
            changeSetId: changeSet.id,
            reason: reason.trim(),
          });
          this.approvalTokens.delete(changeSet.id);
          results.push({ id: changeSet.id, success: true });
        } catch (error) {
          results.push({ id: changeSet.id, success: false, error: error.message });
        }
      }
    } finally {
      this.activeDecisionSession = null;
    }
    this._reportBatchResults(results, 'rejected');
    await this.refreshQueue();
  }

  async archiveSelected(archived, items = this._selectedChangeSets()) {
    return this._runReviewAction(async () => {
      if (!this._validateBatch(items)) return;
      if (items.some(changeSet => Boolean(changeSet.archivedAt) === archived)) {
        this._notify(`Select only ${archived ? 'unarchived' : 'archived'} records.`, 'warning');
        return;
      }
      const explanation = archived
        ? '\nRecords will be hidden and approvals revoked. Genome annotations, reports, and audit history are preserved.'
        : '\nRecords will be visible again. Previous approvals are not restored; pending proposals require a new review.';
      if (!window.confirm(this._batchConfirmationText(items, archived ? 'archive' : 'restore') + explanation)) return;
      this._startDecisionSession(archived ? 'archive' : 'restore', items);
      const results = [];
      for (const changeSet of items) {
        try {
          this._assertReviewWorkspace();
          await this._annotationService().setAnnotationChangesetArchived({ changeSetId: changeSet.id, archived });
          this.approvalTokens.delete(changeSet.id);
          results.push({ id: changeSet.id, success: true });
        } catch (error) {
          results.push({ id: changeSet.id, success: false, error: error.message });
        }
      }
      this._reportBatchResults(results, archived ? 'archived' : 'restored');
      await this.refreshQueue();
      await this.refreshAppliedGenes();
    });
  }

  async deleteSelected(items = this._selectedChangeSets()) {
    return this._runReviewAction(async () => {
      if (!this._validateBatch(items)) return;
      if (items.some(changeSet => !this._isDeletable(changeSet))) {
        this._notify('Applied records cannot be deleted. Archive them instead.', 'warning');
        return;
      }
      const explanation =
        'Deletion cannot be undone. Proposal payloads and approval capabilities will be removed. Research reports and audit history are retained. Genome annotations are unchanged. Failures are isolated.';
      if (!window.confirm(this._batchConfirmationText(items, 'permanently delete', explanation))) return;
      this._startDecisionSession('delete', items);
      const results = [];
      for (const changeSet of items) {
        try {
          this._assertReviewWorkspace();
          await this._annotationService().deleteAnnotationChangeset({ changeSetId: changeSet.id });
          this.approvalTokens.delete(changeSet.id);
          this.changeSets.delete(changeSet.id);
          results.push({ id: changeSet.id, success: true });
        } catch (error) {
          results.push({ id: changeSet.id, success: false, error: error.message });
        }
      }
      this._reportBatchResults(results, 'deleted');
      await this.refreshQueue();
    });
  }

  async proposeRollback(changeSetId) {
    return this._runReviewAction(async () => {
      if (
        !window.confirm(
          `Create a rollback proposal for ${changeSetId}?\nIt will restore the affected fields to their previous values after a separate review and approval. Newer edits to those fields must be resolved first.`
        )
      ) {
        return;
      }
      this._assertReviewWorkspace();
      const result = await this._annotationService().rollbackAnnotationChangeset({ changeSetId });
      const proposal = result.changeSet;
      const status = document.getElementById('annotationReviewFilter');
      if (status) status.value = 'active';
      const risk = document.getElementById('annotationReviewRiskFilter');
      if (risk) risk.value = '';
      const search = document.getElementById('annotationReviewSearch');
      if (search) search.value = '';
      const archiveFilter = document.getElementById('annotationReviewArchiveFilter');
      if (archiveFilter) archiveFilter.value = proposal.archivedAt ? 'all' : 'visible';
      await this.refreshQueue({ focusChangeSetId: proposal.id });
      this._notify(`Rollback proposal ${proposal.id} is ready for review.`, 'success');
    });
  }

  /**
   * Collect the rejection reason and the batch confirmation in one dialog.
   * window.prompt() is unavailable in Electron renderers, so the reason is
   * gathered with an in-app modal instead.
   * Resolves with the trimmed reason, or null when the curator cancels.
   */
  _promptForRejectionReason(selected) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.id = 'annotationReviewReasonDialog';
      overlay.className = 'annotation-review-reason-dialog';
      overlay.innerHTML = `
        <div class="annotation-review-reason-panel" role="dialog" aria-modal="true"
             aria-labelledby="annotationReviewReasonTitle">
          <h4 id="annotationReviewReasonTitle"><i class="fas fa-times-circle"></i> Reject ChangeSets</h4>
          <pre class="annotation-review-reason-summary"></pre>
          <label for="annotationReviewReasonInput">Reason for rejection</label>
          <input id="annotationReviewReasonInput" type="text" maxlength="200" value="curator_rejected">
          <div class="annotation-review-reason-actions">
            <button type="button" class="btn btn-secondary" data-reason-action="cancel">Cancel</button>
            <button type="button" class="btn btn-danger" data-reason-action="confirm">
              <i class="fas fa-times"></i> Reject ${selected.length} ChangeSet(s)
            </button>
          </div>
        </div>
      `;
      overlay.querySelector('.annotation-review-reason-summary').textContent = this._batchConfirmationText(
        selected,
        'reject'
      );

      const input = overlay.querySelector('#annotationReviewReasonInput');
      const previousFocus = document.activeElement;
      let settled = false;
      const close = value => {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKeydown, true);
        overlay.remove();
        previousFocus?.focus();
        resolve(value);
      };
      const submit = () => {
        const value = input.value.trim();
        if (!value) {
          input.focus();
          input.classList.add('is-invalid');
          return;
        }
        close(value);
      };
      const onKeydown = event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          close(null);
        } else if (event.key === 'Enter' && event.target === input) {
          event.preventDefault();
          event.stopImmediatePropagation();
          submit();
        } else if (event.key === 'Tab') {
          const controls = Array.from(overlay.querySelectorAll('input, button'));
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      };

      overlay.addEventListener('click', event => {
        const action = event.target.closest('[data-reason-action]')?.dataset.reasonAction;
        if (action === 'confirm') submit();
        else if (action === 'cancel' || event.target === overlay) close(null);
      });
      input.addEventListener('input', () => input.classList.remove('is-invalid'));
      document.addEventListener('keydown', onKeydown, true);

      document.body.appendChild(overlay);
      input.focus();
      input.select();
    });
  }

  _reportHandlerError(elementId, error) {
    console.error(`[AnnotationReview] handler failed for #${elementId}`, error);
    this._notify(`Annotation review action failed: ${error?.message || error}`, 'error');
  }

  _startDecisionSession(action, changeSets) {
    const items = new Map(changeSets.map(changeSet => [changeSet.id, changeSet.changeSetHash]));
    this.activeDecisionSession = {
      action,
      items,
      principal: this.settings.curatorIdentity,
      expiresAt: Date.now() + 30 * 60 * 1000,
    };
  }

  _duplicateTargets(changeSets) {
    const counts = new Map();
    for (const changeSet of changeSets) {
      const target = changeSet.target || {};
      const key = this._targetKey(changeSet);
      if (!key) continue;
      const entry = counts.get(key) || {
        count: 0,
        label: target.geneSymbol || target.locusTag || key,
      };
      entry.count += 1;
      counts.set(key, entry);
    }
    return Array.from(counts.values())
      .filter(entry => entry.count > 1)
      .map(entry => entry.label);
  }

  _targetKey(changeSet) {
    const target = changeSet?.target || {};
    return target.featureId || [target.chromosome, target.locusTag, target.geneSymbol].filter(Boolean).join(':');
  }

  async confirmAnnotationChangeSet(request = {}) {
    const action = ['reject', 'archive', 'restore', 'delete'].includes(request.action) ? request.action : 'approve';
    const changeSet = request.changeSet || {};
    const session = this.activeDecisionSession;
    if (
      session &&
      session.action === action &&
      session.expiresAt >= Date.now() &&
      session.items.has(changeSet.id) &&
      session.items.get(changeSet.id) === changeSet.changeSetHash
    ) {
      this._assertReviewWorkspace();
      return ['archive', 'restore', 'delete'].includes(action)
        ? { confirmed: true, principal: session.principal }
        : action === 'reject'
          ? { rejected: true, confirmed: true, principal: session.principal }
          : { approved: true, confirmed: true, principal: session.principal };
    }

    const confirmed = window.confirm(request.prompt || `${action[0].toUpperCase()}${action.slice(1)} ${changeSet.id}?`);
    if (!confirmed) return false;
    return ['archive', 'restore', 'delete'].includes(action)
      ? { confirmed: true, principal: this.settings.curatorIdentity }
      : action === 'reject'
        ? { rejected: true, confirmed: true, principal: this.settings.curatorIdentity }
        : { approved: true, confirmed: true, principal: this.settings.curatorIdentity };
  }

  _batchConfirmationText(
    changeSets,
    verb,
    explanation = 'Each ChangeSet will keep its own approval, commit receipt, and audit record. Failures are isolated.'
  ) {
    const targets = changeSets
      .map(changeSet => changeSet.target?.geneSymbol || changeSet.target?.locusTag || changeSet.id)
      .slice(0, 20);
    const omitted = changeSets.length - targets.length;
    const risks = changeSets.reduce((counts, changeSet) => {
      const risk = changeSet.riskLevel || 'unknown';
      counts[risk] = (counts[risk] || 0) + 1;
      return counts;
    }, {});
    return [
      `${verb[0].toUpperCase()}${verb.slice(1)} ${changeSets.length} annotation ChangeSet(s)?`,
      `Reviewer: ${this.settings.curatorIdentity}`,
      `Risk summary: ${Object.entries(risks)
        .map(([risk, count]) => `${risk}=${count}`)
        .join(', ')}`,
      `Targets: ${targets.join(', ')}${omitted > 0 ? `, and ${omitted} more` : ''}`,
      '',
      explanation,
    ].join('\n');
  }

  _reportBatchResults(results, action) {
    const succeeded = results.filter(result => result.success).length;
    const failed = results.length - succeeded;
    const firstFailure = results.find(result => !result.success);
    const message = `${succeeded}/${results.length} ChangeSets ${action}${failed ? `; ${failed} failed (${firstFailure.error})` : ''}.`;
    this._notify(message, failed ? 'warning' : 'success');
  }

  async renderGeneReview(geneId) {
    const container = document.getElementById('geneAnnotationReviewContent');
    if (!container) return;
    container.innerHTML =
      '<div class="annotation-review-loading"><i class="fas fa-spinner fa-spin"></i> Loading review status…</div>';
    try {
      const result = await this._annotationService().listAnnotationChangesets({ query: geneId, limit: 20 });
      this._updatePendingBadge(result.statusCounts || {});
      const changeSets = result.changeSets || [];
      if (changeSets.length === 0) {
        container.innerHTML =
          '<div class="gene-tab-empty">No annotation ChangeSets are associated with this gene.</div>';
        return;
      }
      container.innerHTML = `
        <div class="gene-review-summary">
          <div><strong>${changeSets.length}</strong><span>ChangeSet${changeSets.length === 1 ? '' : 's'}</span></div>
          <div><strong>${changeSets.filter(item => item.status === 'awaiting_approval').length}</strong><span>Awaiting review</span></div>
        </div>
        ${changeSets
          .slice(0, 5)
          .map(
            changeSet => `
              <button class="gene-review-item" onclick="window.genomeBrowser.showAnnotationReviewCenter('${this._escape(changeSet.id)}')">
                <span>${this._escape(this._statusLabel(changeSet.status))}</span>
                <strong>${changeSet.operationCount} proposed changes</strong>
                <small>${this._escape(this._formatDate(changeSet.createdAt))}</small>
              </button>`
          )
          .join('')}
        <button class="btn btn-primary btn-sm gene-review-open" onclick="window.genomeBrowser.showAnnotationReviewCenter()">
          <i class="fas fa-clipboard-check"></i> Open Annotation Review
        </button>`;
    } catch (error) {
      container.innerHTML = `<div class="gene-tab-empty">Unable to load review status: ${this._escape(error.message)}</div>`;
    }
  }

  _populateGovernanceForm() {
    const identity = document.getElementById('annotationCuratorIdentity');
    const expiry = document.getElementById('annotationApprovalExpiry');
    const limit = document.getElementById('annotationBatchLimit');
    const enabled = document.getElementById('annotationBatchReviewEnabled');
    if (identity) identity.value = this.settings.curatorIdentity;
    if (expiry) expiry.value = this.settings.approvalExpiryMinutes;
    if (limit) limit.value = this.settings.batchSizeLimit;
    if (enabled) enabled.checked = this.settings.batchReviewEnabled;
  }

  async saveGovernanceSettings() {
    if (this.isActing) {
      this._notify('Finish the current review action before saving preferences.', 'warning');
      return;
    }
    if (this.isSavingGovernance) return;
    const curatorIdentity = String(document.getElementById('annotationCuratorIdentity')?.value || '').trim();
    if (!curatorIdentity || curatorIdentity.length > 128) {
      this._notify('Curator identity must contain 1–128 characters.', 'error');
      return;
    }
    const nextSettings = {
      curatorIdentity,
      approvalExpiryMinutes: this._boundedNumber(
        document.getElementById('annotationApprovalExpiry')?.value,
        1,
        1440,
        this.defaults.approvalExpiryMinutes
      ),
      batchSizeLimit: this._boundedNumber(
        document.getElementById('annotationBatchLimit')?.value,
        1,
        200,
        this.defaults.batchSizeLimit
      ),
      batchReviewEnabled: document.getElementById('annotationBatchReviewEnabled')?.checked !== false,
    };
    const button = document.getElementById('annotationGovernanceSaveBtn');
    this.isSavingGovernance = true;
    if (button) button.disabled = true;
    try {
      await this.configManager?.set('generalSettings.annotationGovernance', nextSettings);
      await this.configManager?.save();
      this.settings = nextSettings;
      this.app.localCuratorIdentity = curatorIdentity;
      this.approvalTokens.clear();
      this._populateGovernanceForm();
      this._notify('Annotation governance preferences saved.', 'success');
      await this.refreshQueue();
    } finally {
      this.isSavingGovernance = false;
      if (button) button.disabled = false;
    }
  }

  _refreshSelectedGene() {
    if (this.app?.selectedGene?.gene && typeof this.app.populateGeneDetails === 'function') {
      this.app.populateGeneDetails(this.app.selectedGene.gene, this.app.selectedGene.operonInfo);
    }
  }

  /**
   * Keep the header Review badge current without the curator opening the
   * Annotation Review modal. Ledger writes broadcast their own status counts, so a
   * proposal made by an agent shows up immediately; the slow poll is the
   * fallback for ledger state this renderer never observed being written.
   */
  _startPendingBadgeWatch() {
    if (this.badgeWatchStarted || typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }
    this.badgeWatchStarted = true;
    window.addEventListener('annotation-ledger-changed', event => this._handleLedgerChanged(event));
    this.badgeWatchTimer = setInterval(() => {
      // Re-reading the ledger validates every committed receipt, so an
      // unwatched window pays nothing for the fallback poll.
      if (document.hidden) return;
      void this.refreshPendingBadge();
    }, this.badgeWatchIntervalMs);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void this.refreshPendingBadge();
    });
    void this.refreshPendingBadge();
  }

  _handleLedgerChanged(event) {
    const statusCounts = event?.detail?.statusCounts;
    if (statusCounts) {
      this._updatePendingBadge(statusCounts);
      this._updateAppliedCount(statusCounts);
    } else void this.refreshPendingBadge();
    // An open queue would otherwise keep showing the pre-change list while the
    // badge already counts the new ChangeSet. Reloading is only safe while the
    // curator has nothing selected and no decision is in flight.
    const modalIsOpen = document.getElementById('annotationReviewModal')?.classList.contains('show');
    if (modalIsOpen && !this.isActing && !this.activeDecisionSession && this._selectedChangeSets().length === 0) {
      void this.refreshQueue();
    }
    if (modalIsOpen && this._isAppliedTabActive()) void this.refreshAppliedGenes();
  }

  /**
   * Read only the pending counts. listAnnotationChangesets always reports the
   * full ledger status counts, so limit=1 keeps the per-item preview work out
   * of a background poll.
   */
  async refreshPendingBadge() {
    if (this.isLoading || this.isBadgeRefreshing) return;
    this.isBadgeRefreshing = true;
    try {
      const result = await this._annotationService().listAnnotationChangesets({
        statuses: ['awaiting_approval'],
        limit: 1,
      });
      this._updatePendingBadge(result.statusCounts || {});
      this._updateAppliedCount(result.statusCounts || {});
    } catch (error) {
      // No loaded genome, services still starting, or a genome swap mid-poll:
      // leave the badge as it is and let the next tick retry.
      console.debug('[AnnotationReview] pending badge refresh skipped:', error?.message || error);
    } finally {
      this.isBadgeRefreshing = false;
    }
  }

  _updatePendingBadge(statusCounts) {
    const pending = Number(statusCounts.awaiting_approval || 0) + Number(statusCounts.approved || 0);
    document.querySelectorAll('.annotation-review-badge').forEach(badge => {
      badge.textContent = pending > 99 ? '99+' : String(pending);
      badge.hidden = pending === 0;
    });
  }

  _fieldLabel(field) {
    return String(field || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, character => character.toUpperCase());
  }

  _statusLabel(status) {
    const labels = {
      awaiting_approval: 'Awaiting review',
      approved: 'Approved',
      committed: 'Applied',
      rejected: 'Rejected',
      stale: 'Stale',
    };
    return labels[status] || status || 'Unknown';
  }

  _formatDate(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unknown time';
  }

  _displayValue(value) {
    if (value === undefined || value === null || value === '') return '—';
    return Array.isArray(value)
      ? value.join('\n')
      : typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : String(value);
  }

  _compactValue(value, limit = 100) {
    const text = this._displayValue(value).replace(/\s+/g, ' ');
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  }

  _escape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  _notify(message, type = 'info') {
    if (typeof this.app?.showNotification === 'function') {
      this.app.showNotification(message, type);
    } else if (type === 'error') {
      window.alert(message);
    } else {
      console.log(`[AnnotationReview] ${message}`);
    }
  }
}

if (typeof window !== 'undefined') window.AnnotationReviewManager = AnnotationReviewManager;
