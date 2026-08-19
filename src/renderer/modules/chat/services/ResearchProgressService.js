// @ts-check
/**
 * ResearchProgressService - persistent progress dock for long-running research
 * tasks (Deep Gene Research and the annotation research workflow).
 *
 * ChatManager already polls these tasks every 5 s and rewrites a status bubble
 * inside the transcript. That bubble is pinned to the position where the task
 * was submitted, so as soon as the conversation moves on — and a research run
 * takes minutes — it scrolls out of view and the run looks stalled. This dock
 * lives between the transcript and the input box, never scrolls away, and
 * shows every tracked run with its progress, current step and elapsed time.
 */
class ResearchProgressService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
    /** @type {Map<string, any>} taskId -> dock entry */
    this.entries = new Map();
    this.isCollapsed = false;
    this._ticker = null;
    /** Completed runs disappear on their own; failures stay until dismissed. */
    this.completedLingerMs = 45000;
  }

  // --- Public API used by ChatManager -------------------------------------

  /**
   * Create or refresh the dock row for a tracked task.
   * @param {object} taskInfo - the ChatManager activeTasks record
   */
  upsert(taskInfo) {
    if (!taskInfo || !taskInfo.taskId) return;

    const existing = this.entries.get(taskInfo.taskId);
    const startedAt = this._parseTime(taskInfo.createdAt) ?? existing?.startedAt ?? Date.now();
    const status = String(taskInfo.status || existing?.status || 'pending');

    const entry = {
      ...(existing || {}),
      taskId: taskInfo.taskId,
      taskInfo,
      kind: taskInfo.kind || existing?.kind || 'mcp',
      serverId: taskInfo.serverId || existing?.serverId || 'deep-gene-research',
      geneSymbol:
        taskInfo.geneSymbol && taskInfo.geneSymbol !== 'Unknown'
          ? taskInfo.geneSymbol
          : existing?.geneSymbol || taskInfo.geneSymbol || 'Unknown',
      status,
      progress: typeof taskInfo.progress === 'number' ? taskInfo.progress : (existing?.progress ?? null),
      step: taskInfo.currentStep || existing?.step || null,
      error: taskInfo.error || null,
      startedAt,
      updatedAt: Date.now(),
      terminal: this.constructor.isTerminalStatus(status),
      // A poll carrying the server's own status supersedes the optimistic
      // 'cancelling' state, so the button becomes usable again.
      cancelling: false,
    };

    // A run that just reached a terminal state gets a dismissal countdown; a
    // run that is still going must never keep a stale one.
    this._clearDismissTimer(entry);
    this.entries.set(entry.taskId, entry);
    if (entry.terminal && status === 'completed') this._scheduleDismiss(entry.taskId);

    this.render();
  }

  /**
   * Drop a run from the dock (manual dismissal or auto-expiry).
   * @param {string} taskId
   */
  dismiss(taskId) {
    const entry = this.entries.get(taskId);
    if (!entry) return;
    this._clearDismissTimer(entry);
    this.entries.delete(taskId);
    this.render();
  }

  /** Remove every row (used when the transcript is cleared). */
  clear() {
    for (const entry of this.entries.values()) this._clearDismissTimer(entry);
    this.entries.clear();
    this.render();
  }

  /** @returns {boolean} whether any tracked run is still going */
  hasRunningTasks() {
    for (const entry of this.entries.values()) {
      if (!entry.terminal) return true;
    }
    return false;
  }

  /**
   * @param {string} status
   * @returns {boolean}
   */
  static isTerminalStatus(status) {
    return ['completed', 'failed', 'error', 'cancelled'].includes(String(status || '').toLowerCase());
  }

  // --- Rendering ----------------------------------------------------------

  /**
   * Resolve (creating it if needed) the dock element inside the ChatBox panel.
   * Returns null before the chat interface exists.
   * @returns {HTMLElement|null}
   */
  ensureContainer() {
    if (typeof document === 'undefined') return null;

    const existing = document.getElementById('researchProgressDock');
    if (existing && existing.isConnected) return existing;

    const chatPanel = document.getElementById('llmChatPanel');
    if (!chatPanel) return null;

    const dock = document.createElement('div');
    dock.id = 'researchProgressDock';
    dock.className = 'research-progress-dock';
    dock.style.display = 'none';
    dock.innerHTML = `
      <div class="research-progress-header" id="researchProgressHeader" role="button" tabindex="0"
           title="Show or hide the research run list">
        <i class="fas fa-dna research-progress-icon"></i>
        <span class="research-progress-title">Deep Gene Research</span>
        <span class="research-progress-summary" id="researchProgressSummary"></span>
        <i class="fas fa-chevron-down research-progress-caret"></i>
      </div>
      <div class="research-progress-list" id="researchProgressList"></div>
    `;

    // The dock sits directly above the composer so it survives transcript
    // scrolling; fall back to appending when the composer is not there yet.
    const inputContainer = chatPanel.querySelector('.chat-input-container');
    chatPanel.insertBefore(dock, inputContainer || null);

    const header = dock.querySelector('#researchProgressHeader');
    if (header) {
      const toggle = () => {
        this.isCollapsed = !this.isCollapsed;
        this.render();
      };
      header.addEventListener('click', toggle);
      header.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      });
    }

    const list = dock.querySelector('#researchProgressList');
    if (list) {
      list.addEventListener('click', event => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        event.stopPropagation();
        const row = button.closest('[data-task-id]');
        if (!row) return;
        this._handleAction(button.getAttribute('data-action'), row.getAttribute('data-task-id'));
      });
    }

    return dock;
  }

  render() {
    // Nothing to show: hide an existing dock, but never create one just to
    // leave an empty strip above the composer.
    if (this.entries.size === 0) {
      const current = typeof document !== 'undefined' ? document.getElementById('researchProgressDock') : null;
      if (current) current.style.display = 'none';
      this._stopTicker();
      return;
    }

    const dock = this.ensureContainer();
    if (!dock) return;

    dock.style.display = 'block';
    dock.classList.toggle('collapsed', this.isCollapsed);

    const summary = dock.querySelector('#researchProgressSummary');
    if (summary) summary.textContent = this._summaryText();

    const list = dock.querySelector('#researchProgressList');
    if (list) {
      list.style.display = this.isCollapsed ? 'none' : 'block';
      list.innerHTML = Array.from(this.entries.values())
        .sort((a, b) => a.startedAt - b.startedAt)
        .map(entry => this._rowHtml(entry))
        .join('');
    }

    if (this.hasRunningTasks()) this._startTicker();
    else this._stopTicker();
  }

  /**
   * One-line status shown in the dock header, so a collapsed dock still
   * reports where the run is.
   * @returns {string}
   */
  _summaryText() {
    const entries = Array.from(this.entries.values());
    const running = entries.filter(entry => !entry.terminal);
    if (running.length === 1) {
      const entry = running[0];
      const parts = [this._geneLabel(entry)];
      if (typeof entry.progress === 'number') parts.push(`${Math.round(entry.progress)}%`);
      if (entry.step) parts.push(this._humanizeStep(entry.step));
      return parts.filter(Boolean).join(' · ');
    }
    if (running.length > 1) return `${running.length} runs in progress`;
    return entries.length === 1 ? this._statusLabel(entries[0].status) : `${entries.length} finished runs`;
  }

  /**
   * @param {object} entry
   * @returns {string}
   */
  _rowHtml(entry) {
    const state = this._statusClass(entry.status);
    const hasProgress = typeof entry.progress === 'number' && Number.isFinite(entry.progress);
    const percent = hasProgress ? Math.max(0, Math.min(100, Math.round(entry.progress))) : 0;
    const barClass = hasProgress ? 'research-progress-fill' : 'research-progress-fill indeterminate';
    const barStyle = hasProgress ? `width: ${percent}%;` : '';

    const metaParts = [];
    if (entry.step) metaParts.push(this._esc(this._humanizeStep(entry.step)));
    if (entry.error) metaParts.push(`<span class="research-progress-error">${this._esc(entry.error)}</span>`);

    const cancellable = !entry.terminal;
    return `
      <div class="research-progress-item ${state}" data-task-id="${this._esc(entry.taskId)}">
        <div class="research-progress-item-top">
          <span class="research-progress-gene" title="${this._esc(entry.taskId)}">${this._esc(this._geneLabel(entry))}</span>
          <span class="research-progress-status">${this._esc(this._statusLabel(entry.status))}</span>
          <span class="research-progress-elapsed" data-elapsed-for="${this._esc(entry.taskId)}">${this._esc(
            this._formatElapsed(Date.now() - entry.startedAt)
          )}</span>
          <span class="research-progress-actions">
            <button type="button" data-action="locate" title="Show this run in the conversation">
              <i class="fas fa-crosshairs"></i>
            </button>
            ${
              cancellable
                ? '<button type="button" data-action="cancel" title="Cancel this research run"><i class="fas fa-stop"></i></button>'
                : ''
            }
            <button type="button" data-action="dismiss" title="Remove from this list">
              <i class="fas fa-times"></i>
            </button>
          </span>
        </div>
        <div class="research-progress-track">
          <div class="${barClass}" style="${barStyle}"></div>
        </div>
        <div class="research-progress-meta">
          <span class="research-progress-step">${metaParts.join(' — ') || '&nbsp;'}</span>
          <span class="research-progress-percent">${hasProgress ? `${percent}%` : ''}</span>
        </div>
      </div>
    `;
  }

  // --- Elapsed-time ticker ------------------------------------------------

  _startTicker() {
    if (this._ticker || typeof setInterval !== 'function') return;
    this._ticker = setInterval(() => this._updateElapsed(), 1000);
  }

  _stopTicker() {
    if (!this._ticker) return;
    clearInterval(this._ticker);
    this._ticker = null;
  }

  /**
   * Refresh only the elapsed-time labels. A run can sit on the same percentage
   * for minutes, so the ticking clock is what tells the user it is still alive.
   */
  _updateElapsed() {
    if (typeof document === 'undefined') return;
    const now = Date.now();
    // Match by attribute value rather than a selector: task ids come from the
    // server and CSS.escape is not guaranteed in every renderer/test runtime.
    const labels = document.querySelectorAll('#researchProgressList [data-elapsed-for]');
    for (const label of labels) {
      const entry = this.entries.get(label.getAttribute('data-elapsed-for'));
      if (!entry || entry.terminal) continue;
      label.textContent = this._formatElapsed(now - entry.startedAt);
    }
    if (!this.hasRunningTasks()) this._stopTicker();
  }

  // --- Row actions --------------------------------------------------------

  /**
   * @param {string} action
   * @param {string} taskId
   */
  _handleAction(action, taskId) {
    if (action === 'dismiss') return this.dismiss(taskId);
    if (action === 'locate') return this._locate(taskId);
    if (action === 'cancel') return this._cancel(taskId);
  }

  /**
   * Scroll the task's transcript bubble into view and flash it, so the dock
   * row stays a summary and the full detail keeps living in the conversation.
   * @param {string} taskId
   */
  _locate(taskId) {
    const entry = this.entries.get(taskId);
    if (!entry) return;

    const element =
      this.chatManager?.ensureTaskMessageElement?.(entry.taskInfo) ||
      (entry.taskInfo?.messageElement?.isConnected ? entry.taskInfo.messageElement : null);
    if (!element || typeof element.scrollIntoView !== 'function') return;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('research-progress-highlight');
    setTimeout(() => element.classList.remove('research-progress-highlight'), 2000);
  }

  /**
   * Ask the server to stop the run. Workflow runs go through the annotation
   * workflow service so its persisted run state stays consistent.
   * @param {string} taskId
   */
  async _cancel(taskId) {
    const entry = this.entries.get(taskId);
    if (!entry || entry.terminal || entry.cancelling) return;

    const gene = this._geneLabel(entry);
    if (typeof confirm === 'function' && !confirm(`Cancel the Deep Gene Research run for ${gene}?`)) return;

    entry.cancelling = true;
    entry.status = 'cancelling';
    this.render();

    try {
      if (entry.kind === 'workflow') {
        const workflowService = this.chatManager?.services?.annotationWorkflow;
        if (!workflowService?.cancelAnnotationResearch) throw new Error('Annotation workflow service unavailable');
        await workflowService.cancelAnnotationResearch({ taskId });
      } else {
        const manager = this.chatManager?.mcpServerManager;
        if (!manager?.executeToolOnServer) throw new Error('MCP server manager unavailable');
        await manager.executeToolOnServer(entry.serverId, 'cancel-research-run', { taskId });
      }
      // The next poll reports the authoritative status; showing the request
      // immediately keeps the dock responsive without inventing an outcome.
    } catch (error) {
      console.warn(`[ResearchProgressService] Failed to cancel task ${taskId}:`, error);
      entry.cancelling = false;
      entry.status = entry.taskInfo?.status || 'in_progress';
      entry.error = `Cancel failed: ${error.message}`;
      this.render();
    }
  }

  // --- Helpers ------------------------------------------------------------

  /** @param {object} entry */
  _scheduleDismiss(entry) {
    const taskId = typeof entry === 'string' ? entry : entry?.taskId;
    const record = this.entries.get(taskId);
    if (!record || typeof setTimeout !== 'function') return;
    record.dismissTimer = setTimeout(() => this.dismiss(taskId), this.completedLingerMs);
  }

  /** @param {object} entry */
  _clearDismissTimer(entry) {
    if (entry?.dismissTimer) {
      clearTimeout(entry.dismissTimer);
      entry.dismissTimer = null;
    }
  }

  /**
   * @param {string|number|undefined} value
   * @returns {number|null}
   */
  _parseTime(value) {
    if (value == null) return null;
    const parsed = typeof value === 'number' ? value : Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  /** @param {object} entry */
  _geneLabel(entry) {
    return entry.geneSymbol && entry.geneSymbol !== 'Unknown' ? entry.geneSymbol : 'Research run';
  }

  /** @param {string} status */
  _statusLabel(status) {
    switch (String(status || '').toLowerCase()) {
      case 'pending':
      case 'queued':
        return 'Queued';
      case 'in_progress':
      case 'running':
        return 'Researching';
      case 'cancelling':
        return 'Cancelling…';
      case 'completed':
        return 'Completed';
      case 'failed':
      case 'error':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return String(status || 'Unknown').replace(/_/g, ' ');
    }
  }

  /** @param {string} status */
  _statusClass(status) {
    const value = String(status || '').toLowerCase();
    if (value === 'completed') return 'is-completed';
    if (value === 'failed' || value === 'error') return 'is-failed';
    if (value === 'cancelled') return 'is-cancelled';
    return 'is-running';
  }

  /** Turn a machine step id such as `gene-llm-queries` into `Gene llm queries`. */
  _humanizeStep(step) {
    const text = String(step || '')
      .replace(/[-_]+/g, ' ')
      .trim();
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /** @param {number} ms */
  _formatElapsed(ms) {
    const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = value => String(value).padStart(2, '0');
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  }

  /** @param {string} value */
  _esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

if (typeof window !== 'undefined') {
  window.ResearchProgressService = ResearchProgressService;
}
