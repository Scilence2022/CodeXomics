// @ts-check
/**
 * SkillsSettingsManager - Skills tab of the Agent Settings modal.
 *
 * Renders the installed Agent Skill inventory, lets the user enable or disable
 * individual skills, rescan the skill folders, and open the user skills directory.
 * Enable/disable state is owned by SkillService (persisted through ConfigManager);
 * this manager only drives the UI.
 */
class SkillsSettingsManager {
  constructor(chatManager = null) {
    this.chatManager = chatManager || (typeof window !== 'undefined' ? window.chatManager : null);
    this.filterText = '';
    this.isRendering = false;
    this.boundElements = false;

    this.handleSkillsUpdated = () => {
      this.render();
    };

    this.initialize();
  }

  get skillService() {
    return this.chatManager?.services?.skill || null;
  }

  initialize() {
    if (typeof document === 'undefined') return;

    this.bindEvents();

    if (typeof window !== 'undefined') {
      window.addEventListener('codexomics:skills-updated', this.handleSkillsUpdated);
    }
  }

  bindEvents() {
    if (this.boundElements) return;

    const tabButton = document.querySelector('.multi-agent-tabs .tab-button[data-tab="skills"]');
    const reloadBtn = document.getElementById('skillsReloadBtn');
    const openFolderBtn = document.getElementById('skillsOpenFolderBtn');
    const searchInput = document.getElementById('skillsSearchInput');
    const list = document.getElementById('skillsList');

    if (!tabButton || !list) return;

    tabButton.addEventListener('click', () => {
      this.render();
    });

    if (reloadBtn) {
      reloadBtn.addEventListener('click', async () => {
        reloadBtn.disabled = true;
        try {
          await this.skillService?.reload();
          await this.render();
        } finally {
          reloadBtn.disabled = false;
        }
      });
    }

    if (openFolderBtn) {
      openFolderBtn.addEventListener('click', async () => {
        const api = typeof window !== 'undefined' ? window.electronAPI : null;
        if (!api || typeof api.openUserSkillsFolder !== 'function') return;
        const result = await api.openUserSkillsFolder();
        if (!result?.success) {
          this.showDiagnostics([
            { severity: 'warning', message: `Could not open skills folder: ${result?.error || 'unknown error'}` },
          ]);
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.filterText = searchInput.value.trim().toLowerCase();
        this.renderList();
      });
    }

    // Toggling is delegated so re-rendering the list never orphans listeners.
    list.addEventListener('change', async event => {
      const target = event.target;
      if (!target || !target.classList?.contains('skill-toggle')) return;

      const skillId = target.dataset.skillId;
      if (!skillId) return;

      target.disabled = true;
      try {
        const result = await this.skillService?.setSkillEnabled(skillId, target.checked);
        if (!result?.success) {
          target.checked = !target.checked;
          this.showDiagnostics([
            { severity: 'warning', message: `Could not update skill: ${result?.error || 'unknown error'}` },
          ]);
        } else {
          this.renderList();
        }
      } finally {
        target.disabled = false;
      }
    });

    this.boundElements = true;
  }

  async render() {
    this.bindEvents();

    const service = this.skillService;
    if (!service) {
      this.renderEmpty('Skill service is not available.');
      return;
    }

    if (this.isRendering) return;
    this.isRendering = true;
    try {
      await service.ensureSnapshot();
      this.renderSummary();
      this.showDiagnostics(service.getCachedSnapshot()?.diagnostics || []);
      this.renderList();
    } finally {
      this.isRendering = false;
    }
  }

  renderSummary() {
    const summary = document.getElementById('skillsSummary');
    if (!summary) return;

    const skills = this.skillService?.getAllSkills() || [];
    const builtIn = skills.filter(skill => skill.isBuiltIn).length;
    const user = skills.length - builtIn;
    const enabled = skills.filter(skill => skill.enabled).length;

    summary.textContent = `${skills.length} installed · ${builtIn} built-in · ${user} user · ${enabled} enabled`;
  }

  renderList() {
    const list = document.getElementById('skillsList');
    if (!list) return;

    const all = this.skillService?.getAllSkills() || [];
    if (all.length === 0) {
      this.renderEmpty('No skills installed yet. Add one to the user skills folder and press Reload.');
      return;
    }

    const filtered = this.filterText
      ? all.filter(skill =>
          [skill.id, skill.name, skill.description, ...(skill.tags || []), ...(skill.triggers || [])]
            .join(' ')
            .toLowerCase()
            .includes(this.filterText)
        )
      : all;

    if (filtered.length === 0) {
      this.renderEmpty('No skills match the current filter.');
      return;
    }

    list.innerHTML = filtered.map(skill => this.renderSkillCard(skill)).join('');
  }

  renderSkillCard(skill) {
    const id = this.escapeHTML(skill.id);
    const badges = [
      `<span class="skill-badge ${skill.isBuiltIn ? 'skill-badge-builtin' : 'skill-badge-user'}">${
        skill.isBuiltIn ? 'Built-in' : 'User'
      }</span>`,
      skill.category ? `<span class="skill-badge">${this.escapeHTML(skill.category)}</span>` : '',
      skill.requiresGenome ? '<span class="skill-badge">needs genome</span>' : '',
      skill.requiresNetwork ? '<span class="skill-badge">needs network</span>' : '',
    ]
      .filter(Boolean)
      .join('');

    const triggers = (skill.triggers || []).slice(0, 3);
    const triggerHtml = triggers.length
      ? `<div class="skill-triggers">Triggers: ${triggers.map(t => this.escapeHTML(t)).join(' · ')}</div>`
      : '';

    const toolCount = (skill.toolsUsed || []).length;
    const meta = [
      toolCount ? `${toolCount} tool${toolCount === 1 ? '' : 's'}` : '',
      Number.isFinite(skill.typicalDurationSeconds) ? `~${skill.typicalDurationSeconds}s` : '',
      skill.version ? `v${this.escapeHTML(skill.version)}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    return `
      <div class="skill-card ${skill.enabled ? '' : 'skill-card-disabled'}">
        <div class="skill-card-header">
          <label class="skill-toggle-label" title="${skill.enabled ? 'Disable' : 'Enable'} this skill">
            <input type="checkbox" class="skill-toggle setting-checkbox" data-skill-id="${id}" ${
              skill.enabled ? 'checked' : ''
            }>
            <span class="skill-name">${this.escapeHTML(skill.name || skill.id)}</span>
          </label>
          <div class="skill-badges">${badges}</div>
        </div>
        <div class="skill-description">${this.escapeHTML(skill.description || 'No description provided.')}</div>
        ${triggerHtml}
        <div class="skill-meta"><code>${id}</code>${meta ? ` · ${meta}` : ''}</div>
      </div>`;
  }

  renderEmpty(message) {
    const list = document.getElementById('skillsList');
    if (list) {
      list.innerHTML = `<div class="skills-empty">${this.escapeHTML(message)}</div>`;
    }
  }

  showDiagnostics(diagnostics) {
    const container = document.getElementById('skillsDiagnostics');
    if (!container) return;

    const notable = (diagnostics || []).filter(d => d && (d.severity === 'error' || d.severity === 'warning'));
    if (notable.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = notable
      .slice(0, 8)
      .map(d => {
        const file = d.file ? ` (${this.escapeHTML(d.file)})` : '';
        return `<div class="skill-diagnostic skill-diagnostic-${this.escapeHTML(d.severity)}">
          ${this.escapeHTML(d.message)}${file}
        </div>`;
      })
      .join('');
  }

  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.SkillsSettingsManager = SkillsSettingsManager;
