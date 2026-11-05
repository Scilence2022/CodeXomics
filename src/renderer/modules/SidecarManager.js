/**
 * SidecarManager - Manages per-file metadata storage using companion sidecar files
 *
 * For each genome file (e.g., mygenome.gbk), a sidecar file is created
 * (e.g., .codexomics/mygenome.gbk.CodeXomics) to store gene notes, attachments, and other metadata.
 */
class SidecarManager {
  constructor({ getSourceSha256 = () => null, isImportingGenome = () => false } = {}) {
    this.getSourceSha256 = getSourceSha256;
    this.isImportingGenome = isImportingGenome;
    this.legacyWarnings = new Set();
    this.cache = new Map(); // Cache loaded sidecar data by file path
    this.cacheProvenance = new Map(); // genomePath -> verified | fallback
    this.fieldBases = new Map();
    this.writeLocks = new Map();

    console.log('📁 SidecarManager initialized');
  }

  _scope(genomePath, sourceSha256 = this.getSourceSha256(genomePath)) {
    return { genomePath, sourceSha256, cacheKey: sourceSha256 ? `${sourceSha256}:${genomePath}` : genomePath };
  }

  consumeLegacyWarning(genomePath) {
    return this.legacyWarnings.delete(this._scope(genomePath).cacheKey);
  }

  _assertWritable(key) {
    // The annotation overlay can migrate a verified ledger during import.
    // Notes, attachments, and primers still belong to the previously open view
    // until their managers finish reloading.
    if (this.isImportingGenome() && key !== 'annotationCuration') {
      throw new Error('The genome is still loading. Retry the companion-file edit after it finishes.');
    }
  }

  /**
   * Load sidecar data for a genome file
   * @param {string} genomePath - Path to the genome file
   * @returns {Promise<Object>} The sidecar data object
   */
  async load(genomePath, options = {}) {
    if (!genomePath) {
      console.warn('⚠️ SidecarManager.load called with no genomePath');
      return this.getDefaultData();
    }

    return this._load(this._scope(genomePath), options);
  }

  async _load({ genomePath, sourceSha256, cacheKey }, options = {}) {
    if (this.cache.has(cacheKey)) {
      if (options.strict && this.cacheProvenance.get(cacheKey) !== 'verified') {
        throw new Error(`Sidecar data for ${genomePath} was loaded from an unverified fallback`);
      }
      return this.cache.get(cacheKey);
    }

    try {
      const result = await window.electronAPI?.loadSidecarFile?.(genomePath, sourceSha256);
      if (!result?.success) {
        throw Object.assign(new Error(result?.error || 'Sidecar file API unavailable'), {
          code: result?.code,
        });
      }

      const data = result.data || this.getDefaultData(genomePath);
      if (result.sourceSha256) data._sourceGenomeSha256 = result.sourceSha256;
      if (result.legacySkipped) this.legacyWarnings.add(cacheKey);
      this.cache.set(cacheKey, data);
      this.cacheProvenance.set(cacheKey, 'verified');
      return data;
    } catch (error) {
      console.error(`Error loading sidecar file: ${error.message}`);
      if (options.strict || error.code === 'GENOME_SOURCE_CHANGED') throw error;
      const fallbackData = this.getDefaultData(genomePath);
      this.cache.set(cacheKey, fallbackData);
      this.cacheProvenance.set(cacheKey, 'fallback');
      return fallbackData;
    }
  }

  async save(genomePath, data = null) {
    if (!genomePath) throw new Error('Saving sidecar data requires a genome path');
    this._assertWritable();
    const scope = this._scope(genomePath);
    return this._withWriteLock(scope.cacheKey, async () => {
      const snapshot = data || (await this._load(scope, { strict: true }));
      await this._performSave(scope, { ...snapshot, lastModified: new Date().toISOString() });
    });
  }

  async _performSave({ genomePath, sourceSha256, cacheKey }, data) {
    const result = await window.electronAPI?.saveSidecarFile?.(genomePath, data, sourceSha256);
    if (!result?.success) {
      const error = new Error(result?.error || 'Sidecar file API unavailable');
      error.code = result?.code;
      if (result?.conflict || error.code === 'SIDECAR_CONFLICT') {
        error.code = 'SIDECAR_CONFLICT';
        error.currentRevision = result.currentRevision;
        this.cache.delete(cacheKey);
        this.cacheProvenance.delete(cacheKey);
      }
      throw error;
    }

    if (Number.isInteger(result.storageRevision) && result.storageRevision >= 0) {
      data._storageRevision = result.storageRevision;
    }
    if (result.sourceSha256) data._sourceGenomeSha256 = result.sourceSha256;
    this.cache.set(cacheKey, data);
    this.cacheProvenance.set(cacheKey, 'verified');
  }

  async get(genomePath, key, options = {}) {
    const scope = this._scope(genomePath);
    const data = genomePath ? await this._load(scope, options) : this.getDefaultData();
    if (!options.strict) this._rememberFieldBase(scope.cacheKey, key, data[key]);
    return data[key] || {};
  }

  async set(genomePath, key, value) {
    return this._setField(genomePath, key, value, true);
  }

  async setAndForceSave(genomePath, key, value) {
    return this._setField(genomePath, key, value, false);
  }

  async _setField(genomePath, key, value, rebase) {
    if (!genomePath) throw new Error('Saving a sidecar field requires a genome path');
    this._assertWritable(key);
    const scope = this._scope(genomePath);
    return this._withWriteLock(scope.cacheKey, () => this._saveField(scope, key, value, rebase));
  }

  _rememberFieldBase(cacheKey, key, value) {
    if (!this.fieldBases.has(cacheKey)) this.fieldBases.set(cacheKey, new Map());
    this.fieldBases.get(cacheKey).set(key, JSON.stringify(value));
  }

  async _saveField(scope, key, value, rebase) {
    const { cacheKey } = scope;
    const data = await this._load(scope, { strict: true });
    const bases = this.fieldBases.get(cacheKey);
    const expected = rebase && bases?.has(key) ? bases.get(key) : JSON.stringify(data[key]);
    // Track the caller's baseline separately so a refresh for an unrelated key
    // cannot turn a stale field snapshot into an unconditional replacement.
    if (rebase && !bases?.has(key)) this._rememberFieldBase(cacheKey, key, data[key]);
    const desired = JSON.stringify(value);
    const requested = desired === undefined ? undefined : JSON.parse(desired);
    const saveAgainst = async current => {
      if (data._sourceGenomeSha256 !== current._sourceGenomeSha256) {
        throw new Error('The genome file contents changed. Reload before saving.');
      }
      const currentValue = JSON.stringify(current[key]);
      const candidateValue =
        rebase && currentValue !== expected && currentValue !== desired
          ? this._mergeGeneField(
              key,
              expected === undefined ? undefined : JSON.parse(expected),
              current[key],
              requested
            )
          : requested;
      if (JSON.stringify(candidateValue) !== currentValue || !rebase) {
        await this._performSave(scope, {
          ...current,
          [key]: candidateValue,
          lastModified: new Date().toISOString(),
        });
      }
    };

    let current = data;
    for (let attempt = 0; ; attempt++) {
      try {
        await saveAgainst(current);
        break;
      } catch (error) {
        if (!rebase || error.code !== 'SIDECAR_CONFLICT' || this.cache.has(cacheKey) || attempt >= 2) throw error;
        current = await this._load(scope, { strict: true });
      }
    }
    if (rebase) this._rememberFieldBase(cacheKey, key, requested);
  }

  _mergeGeneField(key, baseline, current, requested) {
    const conflict = geneId =>
      Object.assign(
        new Error(
          geneId === undefined
            ? `Sidecar field "${key}" changed in another window. Reload before saving.`
            : `Sidecar field "${key}" changed for gene "${geneId}" in another window. Reload before saving.`
        ),
        { code: 'SIDECAR_CONFLICT' }
      );
    const isMap = value => value && typeof value === 'object' && !Array.isArray(value);
    if (
      !['geneNotes', 'geneAttachments'].includes(key) ||
      !isMap(requested) ||
      (baseline !== undefined && !isMap(baseline)) ||
      (current !== undefined && !isMap(current))
    ) {
      throw conflict();
    }

    const before = new Map(Object.entries(baseline || {}));
    const after = new Map(Object.entries(requested));
    const latest = new Map(Object.entries(current || {}));
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      const previous = JSON.stringify(before.get(id));
      const desired = JSON.stringify(after.get(id));
      if (previous === desired) continue;
      const actual = JSON.stringify(latest.get(id));
      if (actual !== previous && actual !== desired) throw conflict(id);
      if (after.has(id)) latest.set(id, after.get(id));
      else latest.delete(id);
    }
    return Object.fromEntries(latest);
  }

  async _withWriteLock(genomePath, operation) {
    const previous = this.writeLocks.get(genomePath) || Promise.resolve();
    let release;
    const gate = new Promise(resolve => {
      release = resolve;
    });
    const tail = previous.catch(() => {}).then(() => gate);
    this.writeLocks.set(genomePath, tail);
    await previous.catch(() => {});
    try {
      return await operation();
    } finally {
      release();
      if (this.writeLocks.get(genomePath) === tail) this.writeLocks.delete(genomePath);
    }
  }

  /**
   * Get default sidecar data structure
   * @param {string} genomePath - Path to the genome file
   * @returns {Object} Default data structure
   */
  getDefaultData(genomePath = null) {
    const path = window.path;
    return {
      version: '1.0',
      sourceFile: genomePath ? path.basename(genomePath) : null,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      geneNotes: {},
      geneAttachments: {},
      primers: [],
      primerPairs: [],
    };
  }

  /**
   * Clear cached data for a genome file
   * @param {string} genomePath - Path to the genome file
   */
  clearCache(genomePath, sourceSha256) {
    if (genomePath) {
      const { cacheKey } = this._scope(genomePath, sourceSha256);
      this.cache.delete(cacheKey);
      this.cacheProvenance.delete(cacheKey);
      this.fieldBases.delete(cacheKey);
      this.legacyWarnings.delete(cacheKey);
    } else {
      this.cache.clear();
      this.cacheProvenance.clear();
      this.fieldBases.clear();
      this.legacyWarnings.clear();
    }
  }

  async forceSave(genomePath) {
    if (this.cache.has(this._scope(genomePath).cacheKey)) await this.save(genomePath);
  }

  /**
   * Check if a sidecar file exists for a genome file
   * @param {string} genomePath - Path to the genome file
   * @returns {Promise<boolean>} True if sidecar exists
   */
  async exists(genomePath) {
    try {
      if (!window.electronAPI || typeof window.electronAPI.checkSidecarFile !== 'function') {
        return false;
      }

      const result = await window.electronAPI.checkSidecarFile(genomePath, this._scope(genomePath).sourceSha256);
      return Boolean(result && result.success && result.exists);
    } catch (error) {
      return false;
    }
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.SidecarManager = SidecarManager;
}
