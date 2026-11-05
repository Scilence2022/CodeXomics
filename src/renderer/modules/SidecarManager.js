/**
 * SidecarManager - Manages per-file metadata storage using companion sidecar files
 *
 * For each genome file (e.g., mygenome.gbk), a sidecar file is created
 * (e.g., .codexomics/mygenome.gbk.CodeXomics) to store gene notes, attachments, and other metadata.
 */
class SidecarManager {
  constructor() {
    this.cache = new Map(); // Cache loaded sidecar data by file path
    this.cacheProvenance = new Map(); // genomePath -> verified | fallback
    this.fieldBases = new Map();
    this.writeLocks = new Map();

    console.log('📁 SidecarManager initialized');
  }

  /**
   * Get the sidecar file path for a given genome file
   * @param {string} genomePath - Path to the genome file (e.g., /path/to/mygenome.gbk)
   * @returns {string} Path to the sidecar file (e.g., /path/to/mygenome.CodeXomics)
   */
  getSidecarPath(genomePath) {
    if (!genomePath) return null;
    const path = window.path;
    return path.join(path.dirname(genomePath), '.codexomics', `${path.basename(genomePath)}.CodeXomics`);
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

    // Return cached data if available
    if (this.cache.has(genomePath)) {
      if (options.strict && this.cacheProvenance.get(genomePath) !== 'verified') {
        throw new Error(`Sidecar data for ${genomePath} was loaded from an unverified fallback`);
      }
      return this.cache.get(genomePath);
    }

    try {
      if (!window.electronAPI || typeof window.electronAPI.loadSidecarFile !== 'function') {
        if (options.strict) throw new Error('Sidecar file API unavailable');
        const defaultData = this.getDefaultData(genomePath);
        this.cache.set(genomePath, defaultData);
        this.cacheProvenance.set(genomePath, 'fallback');
        return defaultData;
      }

      const result = await window.electronAPI.loadSidecarFile(genomePath);

      if (!result || !result.success) {
        throw new Error(result?.error || 'Sidecar file API unavailable');
      }

      if (!result.exists) {
        console.log(`📄 No sidecar file found for ${genomePath}, using defaults`);
        const defaultData = this.getDefaultData(genomePath);
        this.cache.set(genomePath, defaultData);
        this.cacheProvenance.set(genomePath, 'verified');
        return defaultData;
      }

      const data = result.data || this.getDefaultData(genomePath);

      console.log(`📂 Loaded sidecar data from: ${result.path || this.getSidecarPath(genomePath)}`);
      this.cache.set(genomePath, data);
      this.cacheProvenance.set(genomePath, 'verified');
      return data;
    } catch (error) {
      console.error(`❌ Error loading sidecar file: ${error.message}`);
      if (options.strict) throw error;
      const fallbackData = this.getDefaultData(genomePath);
      this.cache.set(genomePath, fallbackData);
      this.cacheProvenance.set(genomePath, 'fallback');
      return fallbackData;
    }
  }

  async save(genomePath, data = null) {
    if (!genomePath) throw new Error('Saving sidecar data requires a genome path');
    return this._withWriteLock(genomePath, async () => {
      const snapshot = data || (await this.load(genomePath, { strict: true }));
      await this._performSave(genomePath, { ...snapshot, lastModified: new Date().toISOString() });
    });
  }

  async _performSave(genomePath, data) {
    const result = await window.electronAPI?.saveSidecarFile?.(genomePath, data);
    if (!result?.success) {
      const error = new Error(result?.error || 'Sidecar file API unavailable');
      if (result?.conflict || result?.code === 'SIDECAR_CONFLICT') {
        error.code = 'SIDECAR_CONFLICT';
        error.currentRevision = result.currentRevision;
        this.cache.delete(genomePath);
        this.cacheProvenance.delete(genomePath);
      }
      throw error;
    }

    if (Number.isInteger(result.storageRevision) && result.storageRevision >= 0) {
      data._storageRevision = result.storageRevision;
    }
    this.cache.set(genomePath, data);
    this.cacheProvenance.set(genomePath, 'verified');
  }

  async get(genomePath, key, options = {}) {
    const data = await this.load(genomePath, options);
    if (!options.strict) this._rememberFieldBase(genomePath, key, data[key]);
    return data[key] || {};
  }

  async set(genomePath, key, value) {
    return this._withWriteLock(genomePath, () => this._saveField(genomePath, key, value, true));
  }

  async setAndForceSave(genomePath, key, value) {
    return this._withWriteLock(genomePath, () => this._saveField(genomePath, key, value, false));
  }

  _rememberFieldBase(genomePath, key, value) {
    if (!this.fieldBases.has(genomePath)) this.fieldBases.set(genomePath, new Map());
    this.fieldBases.get(genomePath).set(key, JSON.stringify(value));
  }

  async _saveField(genomePath, key, value, rebase) {
    if (!genomePath) throw new Error('Saving a sidecar field requires a genome path');
    const data = await this.load(genomePath, { strict: true });
    const bases = this.fieldBases.get(genomePath);
    const expected = rebase && bases?.has(key) ? bases.get(key) : JSON.stringify(data[key]);
    // Track the caller's baseline separately so a refresh for an unrelated key
    // cannot turn a stale field snapshot into an unconditional replacement.
    if (rebase && !bases?.has(key)) this._rememberFieldBase(genomePath, key, data[key]);
    const desired = JSON.stringify(value);
    const saveAgainst = async current => {
      const currentValue = JSON.stringify(current[key]);
      if (rebase && currentValue !== expected && currentValue !== desired) {
        throw Object.assign(new Error(`Sidecar field "${key}" changed in another window. Reload before saving.`), {
          code: 'SIDECAR_CONFLICT',
        });
      }
      if (currentValue !== desired || !rebase) {
        const candidate = {
          ...current,
          [key]: desired === undefined ? undefined : JSON.parse(desired),
          lastModified: new Date().toISOString(),
        };
        await this._performSave(genomePath, candidate);
      }
    };

    try {
      await saveAgainst(data);
    } catch (error) {
      if (!rebase || error.code !== 'SIDECAR_CONFLICT' || this.cache.has(genomePath)) throw error;
      await saveAgainst(await this.load(genomePath, { strict: true }));
    }
    if (rebase) this._rememberFieldBase(genomePath, key, value);
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
  clearCache(genomePath) {
    if (genomePath) {
      this.cache.delete(genomePath);
      this.cacheProvenance.delete(genomePath);
      this.fieldBases.delete(genomePath);
    } else {
      this.cache.clear();
      this.cacheProvenance.clear();
      this.fieldBases.clear();
    }
  }

  async forceSave(genomePath) {
    if (this.cache.has(genomePath)) await this.save(genomePath);
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

      const result = await window.electronAPI.checkSidecarFile(genomePath);
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
