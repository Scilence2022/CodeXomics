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
      this._notify('Annotation Review Center is not available.', 'error');
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
    document.querySelectorAll('#annotationReviewModal .annotation-review-nav-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.reviewTab === tabName);
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
    if (!list || this.isAppliedLoading) return;
    this.isAppliedLoading = true;
    list.innerHTML =
      '<div class="annotation-review-loading"><i class="fas fa-spinner fa-spin"></i> Loading annotated genes…</div>';
    try {
      const query = document.getElementById('annotationAppliedSearch')?.value || '';
      const result = await this._annotationService().listAnnotationChangesets({
        statuses: ['committed'],
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
    const hasLocation =
      group.chromosome && Number.isFinite(Number(coordinates.start)) && Number.isFinite(Number(coordinates.end));
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

  _handleAppliedClick(event) {
    const actionElement = event.target.closest('[data-action]');
    const action = actionElement?.dataset.action;
    if (action === 'applied-locate') {
      event.stopPropagation();
      this.locateAppliedGene(actionElement.dataset.appliedKey);
      return;
    }
    if (action === 'applied-open-record') {
      event.stopPropagation();
      this.openAppliedRecord(actionElement.dataset.id);
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
  locateAppliedGene(key) {
    const group = this.appliedGeneGroups.get(key);
    const coordinates = group?.coordinates || {};
    if (!group || !group.chromosome || !Number.isFinite(Number(coordinates.start))) {
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
    if (search) search.value = '';
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
    if (this.isLoading) return;
    const queue = document.getElementById('annotationReviewQueue');
    if (!queue) return;
    this.isLoading = true;
    this._renderQueueLoading();
    try {
      const status = document.getElementById('annotationReviewFilter')?.value || 'active';
      const riskLevel = document.getElementById('annotationReviewRiskFilter')?.value || '';
      const query = document.getElementById('annotationReviewSearch')?.value || '';
      const statuses = status === 'active' ? ['awaiting_approval', 'approved'] : status === 'all' ? [] : [status];
      const result = await this._annotationService().listAnnotationChangesets({
        statuses,
        riskLevels: riskLevel ? [riskLevel] : [],
        query,
        limit: 1000,
      });
      this.changeSets = new Map((result.changeSets || []).map(changeSet => [changeSet.id, changeSet]));
      this._closeDetachedDetail();
      this._renderQueue(result);
      this._updatePendingBadge(result.statusCounts || {});
      this._updateAppliedCount(result.statusCounts || {});
      if (options.focusChangeSetId && this.changeSets.has(options.focusChangeSetId)) {
        await this.viewChangeSet(options.focusChangeSetId);
      }
    } catch (error) {
      queue.innerHTML = `<div class="annotation-review-empty error"><i class="fas fa-exclamation-triangle"></i><p>${this._escape(error.message)}</p></div>`;
    } finally {
      this.isLoading = false;
    }
  }

  _renderQueue(result) {
    const queue = document.getElementById('annotationReviewQueue');
    const total = document.getElementById('annotationReviewTotal');
    if (total) total.textContent = `${result.total || 0} ChangeSet${result.total === 1 ? '' : 's'}`;
    if (!queue) return;
    const changeSets = result.changeSets || [];
    this.duplicateTargetCounts = changeSets
      .filter(changeSet => ['awaiting_approval', 'approved'].includes(changeSet.status))
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
    const statusEligible = ['awaiting_approval', 'approved'].includes(changeSet.status);
    const selectedIdentityConflict = statusEligible && this.settings.curatorIdentity === changeSet.createdBy;
    const eligible = statusEligible && !selectedIdentityConflict;
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
        ${
          eligible
            ? `<label class="annotation-review-select" title="Select this ChangeSet for batch review">
                <input type="checkbox" class="annotation-review-checkbox" value="${this._escape(changeSet.id)}"
                  aria-label="Select ${this._escape(label)} ChangeSet for review">
              </label>`
            : `<span class="annotation-review-select annotation-review-read-only" title="${this._escape(readOnlyReason)}"
                aria-label="Read-only ChangeSet: ${this._escape(readOnlyReason)}">
                <i class="fas fa-lock" aria-hidden="true"></i>
              </span>`
        }
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
    this._setActiveChangeSet(changeSetId);
    detail.innerHTML =
      '<div class="annotation-review-loading"><i class="fas fa-spinner fa-spin"></i> Loading full proposal…</div>';
    try {
      const result = await this._annotationService().getAnnotationChangeset({ changeSetId });
      const changeSet = result.changeSet;
      const summary = this.changeSets.get(changeSetId) || {};
      detail.innerHTML = this._renderChangeSetDetail(changeSet, summary);
      detail.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      detail.innerHTML = `<div class="annotation-review-empty error"><p>${this._escape(error.message)}</p></div>`;
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
      </div>
      ${
        attachment
          ? `<div class="annotation-review-report-link"><i class="fas fa-paperclip"></i> Archived report: <code>${this._escape(attachment)}</code>${
              fullTextSourceCount > 0
                ? ` <span>Full text: ${verifiedFullTextSourceCount}/${fullTextSourceCount} evidence-linked sources, ${fullTextFindingCount} findings</span>`
                : ''
            }</div>`
          : ''
      }
      <div class="annotation-review-operations">${operations}</div>
      <details class="annotation-review-evidence" ${evidence ? '' : 'hidden'}>
        <summary>Evidence (${changeSet.evidence?.length || 0})</summary>
        <ul>${evidence}</ul>
      </details>`;
  }

  _handleQueueClick(event) {
    const button = event.target.closest('[data-action]');
    if (button?.dataset.action === 'details') {
      void this.viewChangeSet(button.dataset.id);
      return;
    }
    if (button?.dataset.action === 'close-details') {
      const activeItem = document.querySelector(
        '#annotationReviewQueue .annotation-review-item.is-active .annotation-review-item-main'
      );
      const detail = document.getElementById('annotationReviewDetail');
      if (detail) detail.innerHTML = '';
      this._setActiveChangeSet(null);
      activeItem?.focus();
      return;
    }

    const item = event.target.closest('.annotation-review-item[data-changeset-id]');
    const interactiveControl = event.target.closest('input, label, button, a, select, textarea, summary');
    if (item && !interactiveControl) void this.viewChangeSet(item.dataset.changesetId);
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
    document.querySelectorAll('#annotationReviewQueue .annotation-review-checkbox:not(:disabled)').forEach(input => {
      input.checked = checked;
    });
    this._updateActionState();
  }

  _selectedChangeSets() {
    return Array.from(document.querySelectorAll('#annotationReviewQueue .annotation-review-checkbox:checked'))
      .map(input => this.changeSets.get(input.value))
      .filter(Boolean);
  }

  _updateActionState() {
    const selected = this._selectedChangeSets();
    const count = document.getElementById('annotationReviewSelectedCount');
    if (count) count.textContent = `${selected.length} selected`;
    ['annotationReviewApproveBtn', 'annotationReviewApproveApplyBtn', 'annotationReviewRejectBtn'].forEach(id => {
      const button = document.getElementById(id);
      if (button) button.disabled = selected.length === 0;
    });
    const selectAll = document.getElementById('annotationReviewSelectAll');
    if (selectAll) {
      const eligible = document.querySelectorAll('#annotationReviewQueue .annotation-review-checkbox:not(:disabled)');
      const checked = document.querySelectorAll('#annotationReviewQueue .annotation-review-checkbox:checked');
      const eligibleLabel = document.getElementById('annotationReviewEligibleLabel');
      const selectAllLabel = document.getElementById('annotationReviewSelectAllLabel');
      if (eligibleLabel) eligibleLabel.textContent = `${eligible.length} eligible`;
      selectAll.disabled = eligible.length === 0;
      selectAll.checked = eligible.length > 0 && eligible.length === checked.length;
      selectAll.indeterminate = checked.length > 0 && checked.length < eligible.length;
      if (selectAllLabel) {
        selectAllLabel.classList.toggle('is-disabled', eligible.length === 0);
        selectAllLabel.title =
          eligible.length === 0
            ? 'No awaiting-review or approved ChangeSets are available. Applied, stale, and rejected records are read-only.'
            : `Select all ${eligible.length} ChangeSets that are eligible for review`;
      }
    }
  }

  async approveSelected(applyAfterApproval = false) {
    const selectedChangeSets = this._selectedChangeSets();
    if (!this.settings.batchReviewEnabled && selectedChangeSets.length > 1) {
      this._notify('Batch review is disabled in Governance settings.', 'warning');
      return;
    }
    if (selectedChangeSets.length > this.settings.batchSizeLimit) {
      this._notify(
        `Select no more than ${this.settings.batchSizeLimit} ChangeSets per batch, or raise the limit in Governance.`,
        'warning'
      );
      return;
    }
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
          let approvalToken = changeSet.status === 'approved' ? this.approvalTokens.get(changeSet.id) : null;
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
    const selected = this._selectedChangeSets();
    if (selected.length === 0) return;
    if (selected.length > this.settings.batchSizeLimit) {
      this._notify(
        `Select no more than ${this.settings.batchSizeLimit} ChangeSets per batch, or raise the limit in Governance.`,
        'warning'
      );
      return;
    }
    const reason = await this._promptForRejectionReason(selected);
    if (!reason) return;
    this._startDecisionSession('reject', selected);
    const results = [];
    try {
      for (const changeSet of selected) {
        try {
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

  /**
   * Collect the rejection reason and the batch confirmation in one dialog.
   * window.prompt() is unavailable in Electron renderers, so the reason is
   * gathered with an in-app modal instead.
   * Resolves with the trimmed reason, or null when the curator cancels.
   */
  _promptForRejectionReason(selected) {
    return new Promise(resolve => {
      document.getElementById('annotationReviewReasonDialog')?.remove();

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
      let settled = false;
      const close = value => {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKeydown, true);
        overlay.remove();
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
          event.stopPropagation();
          close(null);
        } else if (event.key === 'Enter' && overlay.contains(event.target)) {
          event.preventDefault();
          submit();
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
      expiresAt: Date.now() + 2 * 60 * 1000,
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
    const action = request.action === 'reject' ? 'reject' : 'approve';
    const changeSet = request.changeSet || {};
    const session = this.activeDecisionSession;
    if (
      session &&
      session.action === action &&
      session.expiresAt >= Date.now() &&
      session.items.get(changeSet.id) === changeSet.changeSetHash
    ) {
      return action === 'reject'
        ? { rejected: true, confirmed: true, principal: session.principal }
        : { approved: true, confirmed: true, principal: session.principal };
    }

    const confirmed = window.confirm(
      request.prompt || `${action === 'reject' ? 'Reject' : 'Approve'} ${changeSet.id}?`
    );
    if (!confirmed) return false;
    return action === 'reject'
      ? { rejected: true, confirmed: true, principal: this.settings.curatorIdentity }
      : { approved: true, confirmed: true, principal: this.settings.curatorIdentity };
  }

  _batchConfirmationText(changeSets, verb) {
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
      'Each ChangeSet will keep its own approval, commit receipt, and audit record. Failures are isolated.',
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
          <i class="fas fa-clipboard-check"></i> Open Review Center
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
    const curatorIdentity = String(document.getElementById('annotationCuratorIdentity')?.value || '').trim();
    if (!curatorIdentity || curatorIdentity.length > 128) {
      this._notify('Curator identity must contain 1–128 characters.', 'error');
      return;
    }
    this.settings = {
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
    this.app.localCuratorIdentity = curatorIdentity;
    await this.configManager?.set('generalSettings.annotationGovernance', this.settings);
    await this.configManager?.save();
    this._populateGovernanceForm();
    this._notify('Annotation governance preferences saved.', 'success');
    await this.refreshQueue();
  }

  _refreshSelectedGene() {
    if (this.app?.selectedGene?.gene && typeof this.app.populateGeneDetails === 'function') {
      this.app.populateGeneDetails(this.app.selectedGene.gene, this.app.selectedGene.operonInfo);
    }
  }

  /**
   * Keep the header Review badge current without the curator opening the
   * Review Center. Ledger writes broadcast their own status counts, so a
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
    if (modalIsOpen && !this.activeDecisionSession && this._selectedChangeSets().length === 0) {
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
