// @ts-check
/* global CoScientistSystem, NotificationService */
/**
 * CoScientistManagerUI - management and monitoring surface for the independent
 * Co-Scientist research agent system.
 */
class CoScientistManagerUI {
  constructor(configManager, chatManager) {
    this.configManager = configManager;
    this.chatManager = chatManager || null;
    this.modal = null;
    this.selectedSessionId = null;
    this.visibleSessions = [];
    this.refreshTimer = null;
    this.isBusy = false;

    this.defaultSettings = {
      coScientistEnabled: true,
      coScientistPersistSessions: true,
      coScientistDefaultDomain: 'biomedicine',
      coScientistAutoRunCycles: false,
      coScientistDefaultCycles: 1,
      coScientistDefaultGenerateCount: 3,
      coScientistDefaultEvolutionCount: 2,
      coScientistReviewDepth: 'standard',
      coScientistIncludeEvolution: true,
      coScientistTopN: 5,
      coScientistAutoRefresh: true,
      coScientistRefreshInterval: 10,
      coScientistShowActivityLog: true,
    };

    this.setupEventListeners();
  }

  setupEventListeners() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners(), { once: true });
      return;
    }

    this.modal = document.getElementById('coScientistManagerModal');
    if (!this.modal || this.modal.dataset.initialized === 'true') return;
    this.modal.dataset.initialized = 'true';

    this.bindClick('coScientistRefreshBtn', () => this.refresh());
    this.bindClick('coScientistStartSessionBtn', () => this.startSession());
    this.bindClick('coScientistRunCycleBtn', () => this.runCycle());
    this.bindClick('coScientistGenerateBtn', () => this.generateHypotheses());
    this.bindClick('coScientistAddEvidenceBtn', () => this.addEvidence());
    this.bindClick('coScientistPauseResumeBtn', () => this.togglePause());
    this.bindClick('coScientistArchiveBtn', () => this.archiveSession());
    this.bindClick('coScientistDeleteBtn', () => this.deleteSession());
    this.bindClick('coScientistClearArchivedBtn', () => this.clearArchivedSessions());

    const includeArchived = document.getElementById('coScientistIncludeArchived');
    if (includeArchived) {
      includeArchived.addEventListener('change', () => this.refresh());
    }

    this.modal.querySelectorAll('.modal-close').forEach(closeBtn => {
      closeBtn.addEventListener('click', () => this.hideModal());
    });

    const resetBtn = this.modal.querySelector('.reset-position-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (window.modalDragManager) {
          window.modalDragManager.resetPosition('#coScientistManagerModal');
        }
      });
    }

    const sessionList = document.getElementById('coScientistSessionList');
    if (sessionList) {
      sessionList.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target.closest('[data-session-id]') : null;
        if (!target) return;
        this.selectedSessionId = target.getAttribute('data-session-id');
        this.renderSessionList(this.visibleSessions);
        this.renderSelectedReport();
      });
    }

    window.addEventListener('multiAgentSettingsChanged', event => {
      this.applySettings(event.detail || {});
    });
  }

  bindClick(id, handler) {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('click', event => {
        event.preventDefault();
        handler();
      });
    }
  }

  showModal() {
    this.modal = document.getElementById('coScientistManagerModal');
    if (!this.modal) return;

    this.applySettingsToControls();
    this.modal.classList.add('show');
    this.initializeDragAndResize();
    this.refresh();
    this.startAutoRefresh();
  }

  hideModal() {
    if (this.modal) {
      this.modal.classList.remove('show');
    }
    this.stopAutoRefresh();
  }

  initializeDragAndResize() {
    if (window.modalDragManager) {
      window.modalDragManager.makeDraggable('#coScientistManagerModal');
      window.modalDragManager.resetPosition('#coScientistManagerModal');
    }
    if (window.resizableModalManager) {
      window.resizableModalManager.makeResizable('#coScientistManagerModal');
    }
  }

  applySettings(settings = {}) {
    const mergedSettings = { ...this.getSettings(), ...settings };
    this.applyPersistenceSetting(mergedSettings);

    if (this.modal?.classList.contains('show')) {
      this.applySettingsToControls(mergedSettings);
      this.updateActionState();
      this.startAutoRefresh();
    }
  }

  applySettingsToControls(explicitSettings = {}) {
    const settings = { ...this.getSettings(), ...explicitSettings };
    this.setInputValue('coScientistDomain', settings.coScientistDefaultDomain || 'biomedicine');
    this.setInputValue('coScientistRunCycleCount', settings.coScientistDefaultCycles || 1);
    this.setInputValue('coScientistRunGenerateCount', settings.coScientistDefaultGenerateCount || 3);
    this.setInputValue('coScientistRunEvolutionCount', settings.coScientistDefaultEvolutionCount || 2);
    this.setInputValue('coScientistRunReviewDepth', settings.coScientistReviewDepth || 'standard');
    this.setInputValue('coScientistRunTopN', settings.coScientistTopN || 5);
    this.setCheckedValue('coScientistRunIncludeEvolution', settings.coScientistIncludeEvolution !== false);
    this.setText('coScientistSystemState', settings.coScientistEnabled === false ? 'Disabled in Settings' : 'Ready');
  }

  getSettings() {
    const savedSettings =
      this.configManager && typeof this.configManager.get === 'function'
        ? this.configManager.get('multiAgentSettings', {})
        : {};
    const managerSettings =
      window.multiAgentSettingsManager && typeof window.multiAgentSettingsManager.getSettings === 'function'
        ? window.multiAgentSettingsManager.getSettings()
        : {};

    return {
      ...this.defaultSettings,
      ...(savedSettings || {}),
      ...(managerSettings || {}),
    };
  }

  isEnabled() {
    return this.getSettings().coScientistEnabled !== false;
  }

  getSystem() {
    if (this.chatManager?.coScientistSystem) {
      return this.chatManager.coScientistSystem;
    }
    if (window.coScientistSystem) {
      return window.coScientistSystem;
    }

    const SystemClass =
      (typeof window !== 'undefined' && window.CoScientistSystem) ||
      (typeof globalThis !== 'undefined' && globalThis.CoScientistSystem) ||
      (typeof CoScientistSystem !== 'undefined' ? CoScientistSystem : null);
    if (typeof SystemClass !== 'function') {
      throw new Error('CoScientistSystem is not available');
    }

    const settings = this.getSettings();
    const systemOptions = {
      app: window.app || null,
      chatManager: this.chatManager,
    };
    if (settings.coScientistPersistSessions === false) {
      systemOptions.storage = null;
    }

    const system = new SystemClass(systemOptions);
    if (this.chatManager) {
      this.chatManager.coScientistSystem = system;
    }
    window.coScientistSystem = system;
    return system;
  }

  applyPersistenceSetting(settings) {
    try {
      const system = this.chatManager?.coScientistSystem || window.coScientistSystem;
      if (system && typeof system.setPersistenceEnabled === 'function') {
        system.setPersistenceEnabled(settings.coScientistPersistSessions !== false);
      }
    } catch (error) {
      console.warn('[CoScientistManagerUI] Failed to apply persistence setting:', error);
    }
  }

  async refresh() {
    try {
      const system = this.getSystem();
      const includeArchived = this.getCheckedValue('coScientistIncludeArchived');
      const visible = system.listSessions({ includeArchived });
      const all = system.listSessions({ includeArchived: true });
      this.visibleSessions = visible.sessions || [];

      if (this.selectedSessionId && !this.visibleSessions.some(session => session.id === this.selectedSessionId)) {
        this.selectedSessionId = null;
      }
      if (!this.selectedSessionId && this.visibleSessions.length > 0) {
        this.selectedSessionId = this.visibleSessions[0].id;
      }

      this.renderOverview(all.sessions || []);
      this.renderSessionList(this.visibleSessions);
      this.renderSelectedReport();
      this.updateActionState();
      this.setStatus('Monitoring refreshed', 'success');
    } catch (error) {
      this.setStatus(error.message || String(error), 'error');
      this.updateActionState();
    }
  }

  startSession() {
    if (!this.isEnabled()) {
      this.setStatus('Co-Scientist is disabled in Agent Settings', 'warning');
      return;
    }

    const researchGoal = this.getInputValue('coScientistResearchGoal').trim();
    if (!researchGoal) {
      this.setStatus('Research goal is required', 'warning');
      return;
    }

    this.runBusyTask(() => {
      const system = this.getSystem();
      const settings = this.getSettings();
      const result = system.startSession({
        researchGoal,
        domain: this.getInputValue('coScientistDomain') || 'biomedicine',
        constraints: this.getInputValue('coScientistConstraints'),
        safetyNotes: this.getInputValue('coScientistSafetyNotes'),
        initialEvidence: this.linesFromText('coScientistInitialEvidence'),
        seedIdeas: this.linesFromText('coScientistSeedIdeas'),
      });

      if (settings.coScientistAutoRunCycles === true) {
        system.runCycle({
          sessionId: result.sessionId,
          cycles: settings.coScientistDefaultCycles,
          generateCount: settings.coScientistDefaultGenerateCount,
          evolutionCount: settings.coScientistDefaultEvolutionCount,
          reviewDepth: settings.coScientistReviewDepth,
          includeEvolution: settings.coScientistIncludeEvolution !== false,
          topN: settings.coScientistTopN,
        });
      }

      this.selectedSessionId = result.sessionId;
      this.setInputValue('coScientistResearchGoal', '');
      this.setInputValue('coScientistInitialEvidence', '');
      this.setInputValue('coScientistSeedIdeas', '');
      this.refresh();
      this.setStatus('Session created', 'success');
    });
  }

  runCycle() {
    if (!this.selectedSessionId) return;
    if (!this.isEnabled()) {
      this.setStatus('Co-Scientist is disabled in Agent Settings', 'warning');
      return;
    }

    this.runBusyTask(() => {
      const settings = this.getSettings();
      this.getSystem().runCycle({
        sessionId: this.selectedSessionId,
        cycles: this.getNumberValue('coScientistRunCycleCount', settings.coScientistDefaultCycles),
        generateCount: this.getNumberValue('coScientistRunGenerateCount', settings.coScientistDefaultGenerateCount),
        evolutionCount: this.getNumberValue('coScientistRunEvolutionCount', settings.coScientistDefaultEvolutionCount),
        reviewDepth: this.getInputValue('coScientistRunReviewDepth') || settings.coScientistReviewDepth,
        includeEvolution: this.getCheckedValue('coScientistRunIncludeEvolution'),
        topN: this.getNumberValue('coScientistRunTopN', settings.coScientistTopN),
      });
      this.refresh();
      this.setStatus('Cycle completed', 'success');
    });
  }

  generateHypotheses() {
    if (!this.selectedSessionId) return;
    if (!this.isEnabled()) {
      this.setStatus('Co-Scientist is disabled in Agent Settings', 'warning');
      return;
    }

    this.runBusyTask(() => {
      const settings = this.getSettings();
      this.getSystem().generateHypotheses({
        sessionId: this.selectedSessionId,
        count: this.getNumberValue('coScientistRunGenerateCount', settings.coScientistDefaultGenerateCount),
      });
      this.refresh();
      this.setStatus('Hypotheses generated', 'success');
    });
  }

  addEvidence() {
    if (!this.selectedSessionId) return;
    if (!this.isEnabled()) {
      this.setStatus('Co-Scientist is disabled in Agent Settings', 'warning');
      return;
    }

    const evidence = this.getInputValue('coScientistEvidenceInput').trim();
    if (!evidence) {
      this.setStatus('Evidence is required', 'warning');
      return;
    }

    this.runBusyTask(() => {
      this.getSystem().addEvidence({
        sessionId: this.selectedSessionId,
        evidence,
        evidenceType: this.getInputValue('coScientistEvidenceType') || 'literature',
        reliability: this.getInputValue('coScientistEvidenceReliability') || 'medium',
      });
      this.setInputValue('coScientistEvidenceInput', '');
      this.refresh();
      this.setStatus('Evidence added', 'success');
    });
  }

  togglePause() {
    if (!this.selectedSessionId) return;

    this.runBusyTask(() => {
      const summary = this.getSelectedSummary();
      const nextStatus = summary?.status === 'paused' || summary?.status === 'archived' ? 'active' : 'paused';
      this.getSystem().updateSessionStatus({
        sessionId: this.selectedSessionId,
        status: nextStatus,
      });
      this.refresh();
      this.setStatus(nextStatus === 'paused' ? 'Session paused' : 'Session resumed', 'success');
    });
  }

  archiveSession() {
    if (!this.selectedSessionId) return;

    this.runBusyTask(() => {
      this.getSystem().updateSessionStatus({
        sessionId: this.selectedSessionId,
        status: 'archived',
      });
      this.refresh();
      this.setStatus('Session archived', 'success');
    });
  }

  deleteSession() {
    if (!this.selectedSessionId) return;
    if (!confirm('Delete this Co-Scientist session?')) return;

    this.runBusyTask(() => {
      const deletedId = this.selectedSessionId;
      this.getSystem().deleteSession({ sessionId: deletedId });
      this.selectedSessionId = null;
      this.refresh();
      this.setStatus('Session deleted', 'success');
    });
  }

  clearArchivedSessions() {
    if (!confirm('Clear archived Co-Scientist sessions?')) return;

    this.runBusyTask(() => {
      const result = this.getSystem().clearSessions({ status: 'archived' });
      if (this.selectedSessionId && result.sessions.some(session => session.id === this.selectedSessionId)) {
        this.selectedSessionId = null;
      }
      this.refresh();
      this.setStatus(`Archived sessions cleared: ${result.deleted}`, 'success');
    });
  }

  runBusyTask(task) {
    try {
      this.setBusy(true);
      task();
    } catch (error) {
      this.setStatus(error.message || String(error), 'error');
    } finally {
      this.setBusy(false);
    }
  }

  renderOverview(sessions) {
    const totals = sessions.reduce(
      (acc, session) => {
        acc.active += session.status === 'active' ? 1 : 0;
        acc.paused += session.status === 'paused' ? 1 : 0;
        acc.archived += session.status === 'archived' ? 1 : 0;
        acc.evidence += session.evidenceCount || 0;
        acc.hypotheses += session.hypothesisCount || 0;
        acc.reviews += session.reviewCount || 0;
        acc.matches += session.tournamentMatchCount || 0;
        return acc;
      },
      { active: 0, paused: 0, archived: 0, evidence: 0, hypotheses: 0, reviews: 0, matches: 0 }
    );

    this.setText('coScientistActiveSessions', totals.active);
    this.setText('coScientistPausedSessions', totals.paused);
    this.setText('coScientistArchivedSessions', totals.archived);
    this.setText('coScientistTotalEvidence', totals.evidence);
    this.setText('coScientistTotalHypotheses', totals.hypotheses);
    this.setText('coScientistTotalReviews', totals.reviews);
    this.setText('coScientistTotalMatches', totals.matches);
  }

  renderSessionList(sessions) {
    const target = document.getElementById('coScientistSessionList');
    if (!target) return;

    if (sessions.length === 0) {
      target.innerHTML = '<div class="co-scientist-empty">No sessions</div>';
      return;
    }

    target.innerHTML = sessions
      .map(session => {
        const active = session.id === this.selectedSessionId ? ' active' : '';
        const title = this.escapeHtml(session.researchGoal);
        const updatedAt = this.formatDate(session.updatedAt);
        return `
          <button type="button" class="co-scientist-session-item${active}" data-session-id="${this.escapeHtml(
            session.id
          )}">
            <span class="co-scientist-session-title">${title}</span>
            <span class="co-scientist-session-meta">
              <span class="co-scientist-status co-scientist-status-${this.escapeHtml(session.status)}">${this.escapeHtml(
                session.status
              )}</span>
              <span>${this.escapeHtml(updatedAt)}</span>
            </span>
            <span class="co-scientist-session-counts">
              H ${session.hypothesisCount || 0} / E ${session.evidenceCount || 0} / R ${session.reviewCount || 0}
            </span>
          </button>
        `;
      })
      .join('');
  }

  renderSelectedReport() {
    const summary = this.getSelectedSummary();
    if (!summary) {
      this.setText('coScientistSessionTitle', 'No session selected');
      this.setText('coScientistSessionMeta', '');
      this.setText('coScientistSessionMetrics', '');
      this.setHtml('coScientistTopHypotheses', '<div class="co-scientist-empty">No hypotheses</div>');
      this.setHtml('coScientistNextActions', '<div class="co-scientist-empty">No actions</div>');
      this.setHtml('coScientistMetaReview', '<div class="co-scientist-empty">No meta-review</div>');
      this.setHtml('coScientistActivityLog', '<div class="co-scientist-empty">No activity</div>');
      this.updateActionState();
      return;
    }

    const settings = this.getSettings();
    const result = this.getSystem().getReport({
      sessionId: summary.id,
      includeEvidence: true,
      includeActivityLog: settings.coScientistShowActivityLog !== false,
      topN: this.getNumberValue('coScientistRunTopN', settings.coScientistTopN),
    });
    const report = result.report;

    this.setText('coScientistSessionTitle', summary.researchGoal);
    this.setText(
      'coScientistSessionMeta',
      `${summary.domain} | ${summary.status} | iteration ${summary.iteration || 0} | updated ${this.formatDate(
        summary.updatedAt
      )}`
    );
    this.setText(
      'coScientistSessionMetrics',
      `Evidence ${summary.evidenceCount || 0} | Hypotheses ${summary.hypothesisCount || 0} | Reviews ${
        summary.reviewCount || 0
      } | Matches ${summary.tournamentMatchCount || 0}`
    );

    this.renderTopHypotheses(report.topHypotheses || []);
    this.renderNextActions(report.nextActions || []);
    this.renderMetaReview(report.metaReview);
    this.renderActivityLog(report.activityLog || []);
    this.updateActionState(summary);
  }

  renderTopHypotheses(items) {
    if (items.length === 0) {
      this.setHtml('coScientistTopHypotheses', '<div class="co-scientist-empty">No hypotheses</div>');
      return;
    }

    this.setHtml(
      'coScientistTopHypotheses',
      items
        .map(item => {
          const hypothesis = item.hypothesis || {};
          const score = item.overall === null || item.overall === undefined ? '--' : item.overall;
          return `
            <div class="co-scientist-hypothesis">
              <div class="co-scientist-hypothesis-rank">#${item.rank}</div>
              <div class="co-scientist-hypothesis-body">
                <strong>${this.escapeHtml(item.title || hypothesis.title || 'Untitled hypothesis')}</strong>
                <p>${this.escapeHtml(hypothesis.statement || '')}</p>
                <span>ELO ${item.elo || '--'} | Score ${score} | ${this.escapeHtml(item.status || '')}</span>
              </div>
            </div>
          `;
        })
        .join('')
    );
  }

  renderNextActions(actions) {
    if (actions.length === 0) {
      this.setHtml('coScientistNextActions', '<div class="co-scientist-empty">No actions</div>');
      return;
    }

    this.setHtml(
      'coScientistNextActions',
      `<ul class="co-scientist-list">${actions.map(action => `<li>${this.escapeHtml(action)}</li>`).join('')}</ul>`
    );
  }

  renderMetaReview(metaReview) {
    if (!metaReview) {
      this.setHtml('coScientistMetaReview', '<div class="co-scientist-empty">No meta-review</div>');
      return;
    }

    const guidance = (metaReview.guidance || []).map(item => `<li>${this.escapeHtml(item)}</li>`).join('');
    const issues = (metaReview.recurringIssues || [])
      .map(item => `<li>${this.escapeHtml(item.issue)} <span>${item.count}</span></li>`)
      .join('');
    this.setHtml(
      'coScientistMetaReview',
      `
        <div class="co-scientist-meta-review">
          <strong>${this.escapeHtml(metaReview.agent || 'MetaReviewAgent')}</strong>
          <ul class="co-scientist-list">${guidance}</ul>
          ${issues ? `<ol class="co-scientist-issue-list">${issues}</ol>` : ''}
        </div>
      `
    );
  }

  renderActivityLog(activityLog) {
    if (activityLog.length === 0) {
      this.setHtml('coScientistActivityLog', '<div class="co-scientist-empty">No activity</div>');
      return;
    }

    this.setHtml(
      'coScientistActivityLog',
      activityLog
        .slice(-12)
        .reverse()
        .map(item => {
          return `
            <div class="co-scientist-activity-item">
              <span>${this.escapeHtml(item.agent || '')}</span>
              <strong>${this.escapeHtml(item.event || '')}</strong>
              <time>${this.escapeHtml(this.formatDate(item.createdAt))}</time>
            </div>
          `;
        })
        .join('')
    );
  }

  getSelectedSummary() {
    return this.visibleSessions.find(session => session.id === this.selectedSessionId) || null;
  }

  updateActionState(summary = this.getSelectedSummary()) {
    const hasSelected = Boolean(summary);
    const canRun = this.isEnabled() && hasSelected && !this.isBusy;
    const disabled = !this.isEnabled() || this.isBusy;

    this.setDisabled('coScientistStartSessionBtn', disabled);
    this.setDisabled('coScientistRunCycleBtn', !canRun);
    this.setDisabled('coScientistGenerateBtn', !canRun);
    this.setDisabled('coScientistAddEvidenceBtn', !canRun);
    this.setDisabled('coScientistPauseResumeBtn', !hasSelected || this.isBusy);
    this.setDisabled('coScientistArchiveBtn', !hasSelected || this.isBusy);
    this.setDisabled('coScientistDeleteBtn', !hasSelected || this.isBusy);

    const pauseBtn = document.getElementById('coScientistPauseResumeBtn');
    if (pauseBtn) {
      pauseBtn.innerHTML =
        summary?.status === 'paused' || summary?.status === 'archived'
          ? '<i class="fas fa-play"></i> Resume'
          : '<i class="fas fa-pause"></i> Pause';
    }
  }

  setBusy(isBusy) {
    this.isBusy = isBusy;
    this.updateActionState();
  }

  startAutoRefresh() {
    this.stopAutoRefresh();
    const settings = this.getSettings();
    if (settings.coScientistAutoRefresh === false || !this.modal?.classList.contains('show')) return;

    const seconds = Math.max(5, Number.parseInt(settings.coScientistRefreshInterval, 10) || 10);
    this.refreshTimer = setInterval(() => this.refresh(), seconds * 1000);
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  linesFromText(id) {
    return this.getInputValue(id)
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean);
  }

  getInputValue(id) {
    const element = document.getElementById(id);
    return element && 'value' in element ? String(element.value || '') : '';
  }

  setInputValue(id, value) {
    const element = document.getElementById(id);
    if (element && 'value' in element) {
      element.value = value;
    }
  }

  getNumberValue(id, fallback) {
    const parsed = Number.parseInt(this.getInputValue(id), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  getCheckedValue(id) {
    const element = document.getElementById(id);
    return element && 'checked' in element ? Boolean(element.checked) : false;
  }

  setCheckedValue(id, value) {
    const element = document.getElementById(id);
    if (element && 'checked' in element) {
      element.checked = Boolean(value);
    }
  }

  setDisabled(id, disabled) {
    const element = document.getElementById(id);
    if (element && 'disabled' in element) {
      element.disabled = Boolean(disabled);
    }
  }

  setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value === undefined || value === null ? '' : String(value);
    }
  }

  setHtml(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.innerHTML = value;
    }
  }

  setStatus(message, type = 'info') {
    const element = document.getElementById('coScientistStatusText');
    if (element) {
      element.textContent = message;
      element.className = `co-scientist-status-text ${type}`;
    }

    if (type === 'error' && typeof NotificationService !== 'undefined') {
      const service = window._notificationService || new NotificationService();
      window._notificationService = service;
      service.toast(message, 'error');
    }
  }

  formatDate(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

if (typeof window !== 'undefined') {
  window.CoScientistManagerUI = CoScientistManagerUI;
}

if (typeof globalThis !== 'undefined') {
  globalThis.CoScientistManagerUI = CoScientistManagerUI;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CoScientistManagerUI;
}
