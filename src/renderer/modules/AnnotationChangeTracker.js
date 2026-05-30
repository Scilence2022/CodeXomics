/**
 * AnnotationChangeTracker - Tracks all annotation modifications for audit purposes.
 *
 * Records every create, update, and delete operation on genome annotations,
 * enabling AI agents and human curators to review changes, compare before/after
 * values, and maintain a full audit trail.
 *
 * Designed to work with both ChatBox (interactive) and MCP (AI agent) contexts.
 *
 * @class
 */
class AnnotationChangeTracker {
  constructor() {
    /** @type {Array<ChangeRecord>} */
    this.changes = [];

    /** @type {string} localStorage key for persistence */
    this.storageKey = 'codexomics_annotation_changes';

    // Load persisted changes
    this._loadFromStorage();
  }

  /**
   * Record an annotation change.
   *
   * @param {Object} params
   * @param {string} params.action - "create" | "update" | "delete"
   * @param {string} params.annotationId - locus_tag, gene name, or other identifier
   * @param {string} params.chromosome - Chromosome/replicon name
   * @param {string} [params.field] - Qualifier field that changed (for updates)
   * @param {*} [params.oldValue] - Previous value (for updates/deletes)
   * @param {*} [params.newValue] - New value (for creates/updates)
   * @param {string} [params.agent="user"] - Who made the change
   * @param {string} [params.source="ui"] - "ui" | "chatbox" | "mcp"
   * @param {string[]} [params.evidence] - Supporting references
   * @param {Object} [params.metadata] - Additional context
   * @returns {Object} The created change record
   */
  recordChange({
    action,
    annotationId,
    chromosome,
    field = null,
    oldValue = null,
    newValue = null,
    agent = 'user',
    source = 'ui',
    evidence = [],
    metadata = {},
  }) {
    const record = {
      id: this._generateId(),
      timestamp: new Date().toISOString(),
      action,
      annotationId,
      chromosome: chromosome || 'unknown',
      field,
      oldValue,
      newValue,
      agent,
      source,
      evidence,
      metadata,
    };

    this.changes.push(record);
    this._saveToStorage();

    console.log(
      `📝 [AnnotationChangeTracker] ${action.toUpperCase()} recorded: ${annotationId}` +
        (field ? `.${field}` : '') +
        ` by ${agent} (${source})`
    );

    return record;
  }

  /**
   * Record multiple field updates for a single annotation.
   *
   * @param {string} annotationId - Annotation identifier
   * @param {string} chromosome - Chromosome name
   * @param {Object} updates - {field: newValue} map
   * @param {Object} oldValues - {field: oldValue} map
   * @param {string} agent - Agent identity
   * @param {string} source - Change source
   * @param {string[]} evidence - Evidence references
   * @returns {Array<Object>} Created change records
   */
  recordMultiFieldUpdate(annotationId, chromosome, updates, oldValues, agent, source, evidence = []) {
    const records = [];
    for (const [field, newValue] of Object.entries(updates)) {
      const oldValue = oldValues[field] !== undefined ? oldValues[field] : null;
      // Only record if the value actually changed
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        records.push(
          this.recordChange({
            action: 'update',
            annotationId,
            chromosome,
            field,
            oldValue,
            newValue,
            agent,
            source,
            evidence,
          })
        );
      }
    }
    return records;
  }

  /**
   * Get change history for a specific annotation.
   *
   * @param {string} annotationId - locus_tag or gene name
   * @param {number} [limit=50] - Max records to return
   * @returns {Array<Object>} Change records, newest first
   */
  getHistory(annotationId, limit = 50) {
    const filtered = this.changes
      .filter(c => c.annotationId === annotationId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return limit > 0 ? filtered.slice(0, limit) : filtered;
  }

  /**
   * Get all change records, optionally filtered.
   *
   * @param {Object} [filters]
   * @param {string} [filters.action] - Filter by action type
   * @param {string} [filters.agent] - Filter by agent
   * @param {string} [filters.source] - Filter by source
   * @param {string} [filters.chromosome] - Filter by chromosome
   * @param {string} [filters.since] - ISO8601 timestamp to start from
   * @param {number} [filters.limit=50] - Max records
   * @returns {Array<Object>} Filtered change records, newest first
   */
  getAllChanges(filters = {}) {
    let result = [...this.changes];

    if (filters.action) {
      result = result.filter(c => c.action === filters.action);
    }
    if (filters.agent) {
      result = result.filter(c => c.agent === filters.agent);
    }
    if (filters.source) {
      result = result.filter(c => c.source === filters.source);
    }
    if (filters.chromosome) {
      result = result.filter(c => c.chromosome === filters.chromosome);
    }
    if (filters.since) {
      const sinceDate = new Date(filters.since);
      result = result.filter(c => new Date(c.timestamp) >= sinceDate);
    }

    result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const limit = filters.limit || 50;
    return limit > 0 ? result.slice(0, limit) : result;
  }

  /**
   * Get a summary of changes by agent.
   *
   * @returns {Object} Summary stats
   */
  getSummary() {
    const byAgent = {};
    const byAction = { create: 0, update: 0, delete: 0 };
    const byChromosome = {};

    for (const change of this.changes) {
      byAgent[change.agent] = (byAgent[change.agent] || 0) + 1;
      byAction[change.action] = (byAction[change.action] || 0) + 1;
      byChromosome[change.chromosome] = (byChromosome[change.chromosome] || 0) + 1;
    }

    return {
      totalChanges: this.changes.length,
      byAgent,
      byAction,
      byChromosome,
      oldestChange: this.changes.length > 0 ? this.changes[0].timestamp : null,
      newestChange: this.changes.length > 0 ? this.changes[this.changes.length - 1].timestamp : null,
    };
  }

  /**
   * Export changelog in a structured format.
   *
   * @param {string} [format="json"] - "json" or "text"
   * @returns {string} Formatted changelog
   */
  exportChangelog(format = 'json') {
    if (format === 'text') {
      const lines = this.changes.map(c => {
        const ts = c.timestamp.replace('T', ' ').replace(/\.\d+Z$/, 'Z');
        let line = `[${ts}] ${c.action.toUpperCase()} ${c.annotationId}`;
        if (c.field) {
          line += `.${c.field}: "${c.oldValue}" → "${c.newValue}"`;
        }
        line += ` (by ${c.agent}, via ${c.source})`;
        if (c.evidence && c.evidence.length > 0) {
          line += ` [evidence: ${c.evidence.join(', ')}]`;
        }
        return line;
      });
      return lines.join('\n');
    }

    return JSON.stringify(this.changes, null, 2);
  }

  /**
   * Clear all change history.
   */
  clearHistory() {
    this.changes = [];
    this._saveToStorage();
    console.log('📝 [AnnotationChangeTracker] History cleared');
  }

  /**
   * Get the count of total changes tracked.
   * @returns {number}
   */
  get size() {
    return this.changes.length;
  }

  // --- Private methods ---

  _generateId() {
    return `chg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  _saveToStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        // Keep only the last 10000 records to prevent storage overflow
        const toSave = this.changes.slice(-10000);
        localStorage.setItem(this.storageKey, JSON.stringify(toSave));
      }
    } catch (e) {
      console.warn('[AnnotationChangeTracker] Failed to save to localStorage:', e.message);
    }
  }

  _loadFromStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          this.changes = JSON.parse(stored);
          console.log(`📝 [AnnotationChangeTracker] Loaded ${this.changes.length} change records from storage`);
        }
      }
    } catch (e) {
      console.warn('[AnnotationChangeTracker] Failed to load from localStorage:', e.message);
      this.changes = [];
    }
  }
}

// Make available globally and as module
if (typeof window !== 'undefined') {
  window.AnnotationChangeTracker = AnnotationChangeTracker;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnnotationChangeTracker;
}
