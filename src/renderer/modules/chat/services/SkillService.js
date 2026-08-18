// @ts-check
/**
 * SkillService - Agent Skill discovery and progressive disclosure for the ChatBox.
 *
 * A Skill is a reusable, multi-step workflow document that teaches the assistant how
 * to accomplish a domain task with the CodeXomics tool suite. Skills live on disk and
 * are inventoried by the main-process SkillRegistryService; this service caches that
 * snapshot, applies the user's enable/disable choices, and renders the compact index
 * that goes into the system prompt.
 *
 * Progressive disclosure: only the index (id + description + triggers) is prompted.
 * The assistant calls `get_skill` to pull a full workflow body when it decides a skill
 * applies, so unused skill bodies never consume context.
 */
class SkillService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
    this.snapshot = null;
    this.loadPromise = null;
    this.bodyCache = new Map();

    this.subscribeToRegistryUpdates();

    // Warm the inventory so the first system prompt already carries the skill index.
    this.ensureSnapshot().catch(error => {
      console.warn('[SkillService] Initial skill snapshot load failed:', error);
    });
  }

  get api() {
    return typeof window !== 'undefined' ? window.electronAPI : null;
  }

  get configManager() {
    return this.chatManager?.configManager || null;
  }

  subscribeToRegistryUpdates() {
    const api = this.api;
    if (!api || typeof api.onSkillRegistryUpdated !== 'function') return;

    try {
      api.onSkillRegistryUpdated(snapshot => {
        this.snapshot = snapshot && typeof snapshot === 'object' ? snapshot : null;
        this.bodyCache.clear();
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('codexomics:skills-updated', { detail: this.snapshot }));
        }
      });
    } catch (error) {
      console.warn('[SkillService] Failed to subscribe to skill registry updates:', error);
    }
  }

  // --- Snapshot access -------------------------------------------------------

  /**
   * Load (and cache) the skill inventory. Concurrent callers share one request.
   */
  async ensureSnapshot(options = {}) {
    if (this.snapshot && !options.force) return this.snapshot;

    const api = this.api;
    if (!api || typeof api.getSkillRegistrySnapshot !== 'function') {
      this.snapshot = this.createEmptySnapshot('Skill registry bridge is unavailable');
      return this.snapshot;
    }

    if (!this.loadPromise || options.force) {
      this.loadPromise = (async () => {
        try {
          const snapshot = options.force ? await api.reloadSkillRegistry() : await api.getSkillRegistrySnapshot();
          this.snapshot = snapshot && typeof snapshot === 'object' ? snapshot : this.createEmptySnapshot();
        } catch (error) {
          console.warn('[SkillService] Failed to load skill registry snapshot:', error);
          this.snapshot = this.createEmptySnapshot(error.message);
        } finally {
          this.loadPromise = null;
        }
        return this.snapshot;
      })();
    }

    return this.loadPromise;
  }

  async reload() {
    this.bodyCache.clear();
    return this.ensureSnapshot({ force: true });
  }

  createEmptySnapshot(error = null) {
    return {
      success: false,
      skills: [],
      skillsById: {},
      counts: { skills: 0, appSkills: 0, userSkills: 0 },
      roots: { appSkills: null, userSkills: null },
      diagnostics: error ? [{ severity: 'warning', message: error, source: 'skill_service' }] : [],
    };
  }

  /**
   * Snapshot without waiting. Returns null before the first load resolves; callers on
   * the prompt path use this so building a system message never blocks on IPC.
   */
  getCachedSnapshot() {
    return this.snapshot;
  }

  // --- Enable / disable ------------------------------------------------------

  getDisabledIds() {
    const configured = this.configManager?.get?.('skills.disabledIds', []);
    return Array.isArray(configured) ? configured.filter(id => typeof id === 'string') : [];
  }

  isEnabled(skillId) {
    return !this.getDisabledIds().includes(skillId);
  }

  async setSkillEnabled(skillId, enabled) {
    if (!this.configManager || typeof this.configManager.set !== 'function') {
      return { success: false, error: 'Configuration manager is unavailable' };
    }

    const disabled = new Set(this.getDisabledIds());
    if (enabled) {
      disabled.delete(skillId);
    } else {
      disabled.add(skillId);
    }

    try {
      await this.configManager.set('skills.disabledIds', [...disabled]);
      return { success: true, enabled };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * All inventoried skills, each tagged with its current enabled state.
   */
  getAllSkills() {
    const skills = this.snapshot?.skills;
    if (!Array.isArray(skills)) return [];
    const disabled = new Set(this.getDisabledIds());
    return skills.map(skill => ({ ...skill, enabled: !disabled.has(skill.id) }));
  }

  getEnabledSkills() {
    return this.getAllSkills().filter(skill => skill.enabled);
  }

  // --- Prompt rendering ------------------------------------------------------

  /**
   * Compact skill index for the system prompt. Deliberately terse: the assistant
   * only needs enough to decide whether to call get_skill.
   */
  getSkillIndexForPrompt(options = {}) {
    const maxSkills = Number.isFinite(options.maxSkills) ? options.maxSkills : 25;
    const skills = this.getEnabledSkills();
    if (skills.length === 0) return '';

    const shown = skills.slice(0, maxSkills);
    const lines = shown.map(skill => {
      const triggers = skill.triggers?.length ? ` | triggers: ${skill.triggers.slice(0, 4).join('; ')}` : '';
      const needs = [skill.requiresGenome ? 'genome' : null, skill.requiresNetwork ? 'network' : null]
        .filter(Boolean)
        .join('+');
      const requires = needs ? ` | requires: ${needs}` : '';
      return `- ${skill.id}: ${skill.description || 'No description provided.'}${triggers}${requires}`;
    });

    const truncated =
      skills.length > shown.length ? `\n(${skills.length - shown.length} more — call list_skills to see them)` : '';

    // Use a real, enabled skill in the example so the model never sees an id it cannot load.
    const exampleId = shown[0].id;

    return `===AGENT SKILLS===
Skills are expert, multi-step workflows for this application. When a request matches a
skill below, call get_skill FIRST to load its workflow, then follow that workflow instead
of improvising a tool chain.

${lines.join('\n')}${truncated}

- Load a skill: {"tool_name": "get_skill", "parameters": {"skill_id": "${exampleId}"}}
- Browse skills: {"tool_name": "list_skills", "parameters": {}}
Do not guess a skill's steps from its description; load it first.`;
  }

  // --- Tool implementations --------------------------------------------------

  /**
   * `list_skills` - enumerate available skills without loading their bodies.
   */
  async listSkills(parameters = {}) {
    await this.ensureSnapshot();

    const { category = null, query = null, include_disabled: includeDisabled = false } = parameters || {};
    let skills = includeDisabled ? this.getAllSkills() : this.getEnabledSkills();

    if (typeof category === 'string' && category.trim()) {
      const wanted = category.trim().toLowerCase();
      skills = skills.filter(skill => String(skill.category || '').toLowerCase() === wanted);
    }

    if (typeof query === 'string' && query.trim()) {
      const needle = query.trim().toLowerCase();
      skills = skills.filter(skill =>
        [skill.id, skill.name, skill.description, ...(skill.tags || []), ...(skill.triggers || [])]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      );
    }

    return {
      success: true,
      count: skills.length,
      total_available: this.getAllSkills().length,
      filtered_category: category || null,
      skills: skills.map(skill => ({
        skill_id: skill.id,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        tags: skill.tags,
        triggers: skill.triggers,
        tools_used: skill.toolsUsed,
        requires_genome: skill.requiresGenome,
        requires_network: skill.requiresNetwork,
        typical_duration_seconds: skill.typicalDurationSeconds,
        source: skill.isBuiltIn ? 'built-in' : 'user',
        format: skill.format,
        enabled: skill.enabled,
        resources: skill.resources,
      })),
      hint: 'Call get_skill with a skill_id to load the full workflow before executing it.',
    };
  }

  /**
   * `get_skill` - load one skill's full workflow body on demand.
   */
  async getSkill(parameters = {}) {
    const skillId = typeof parameters?.skill_id === 'string' ? parameters.skill_id.trim() : '';
    if (!skillId) {
      return { success: false, error: 'Missing required parameter: skill_id' };
    }

    await this.ensureSnapshot();

    const skill = this.getAllSkills().find(entry => entry.id === skillId);
    if (!skill) {
      const available = this.getEnabledSkills()
        .map(entry => entry.id)
        .join(', ');
      return {
        success: false,
        error: `Skill not found: ${skillId}`,
        available_skills: available || 'none',
      };
    }

    if (!skill.enabled) {
      return {
        success: false,
        error: `Skill '${skillId}' is disabled in Skills settings`,
      };
    }

    let loaded = this.bodyCache.get(skillId);
    if (loaded === undefined) {
      const api = this.api;
      if (!api || typeof api.getSkill !== 'function') {
        return { success: false, error: 'Skill registry bridge is unavailable' };
      }

      const response = await api.getSkill(skillId);
      if (!response?.success) {
        return { success: false, error: response?.error || `Failed to load skill: ${skillId}` };
      }
      loaded = { body: response.body || '', workflow: response.workflow || null };
      this.bodyCache.set(skillId, loaded);
    }
    const { body, workflow } = loaded;

    return {
      success: true,
      skill_id: skill.id,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      version: skill.version,
      source: skill.isBuiltIn ? 'built-in' : 'user',
      format: skill.format,
      requires_genome: skill.requiresGenome,
      requires_network: skill.requiresNetwork,
      tools_used: skill.toolsUsed,
      resources: skill.resources,
      // The step plan lives in the frontmatter; the Markdown body carries the rationale,
      // result interpretation, and troubleshooting. The assistant needs both.
      workflow: workflow || null,
      guide: body,
      instructions:
        'Execute workflow.steps in order, honouring depends_on and running parallel_groups ' +
        'together. Check workflow.preconditions first. Apply workflow.agent_notes — they cover ' +
        'the parameter shapes and failure modes of these specific tools. Report results using ' +
        'workflow.outputs.summary_template. The guide field explains the reasoning behind each step.',
    };
  }

  /**
   * Read a resource file bundled with a skill (Anthropic-format skill packages).
   */
  async getSkillResource(skillId, resourcePath) {
    const api = this.api;
    if (!api || typeof api.getSkillResource !== 'function') {
      return { success: false, error: 'Skill registry bridge is unavailable' };
    }
    return api.getSkillResource(skillId, resourcePath);
  }
}

window.SkillService = SkillService;
