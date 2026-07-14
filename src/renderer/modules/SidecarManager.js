/**
 * SidecarManager - Manages per-file metadata storage using companion sidecar files
 *
 * For each genome file (e.g., mygenome.gbk), a sidecar file is created
 * (e.g., mygenome.CodeXomics) to store gene notes, attachments, and other metadata.
 */
class SidecarManager {
  constructor() {
    this.cache = new Map(); // Cache loaded sidecar data by file path
    this.cacheProvenance = new Map(); // genomePath -> verified | fallback
    this.pendingSaves = new Map(); // Track pending save operations
    this.writeLocks = new Map();
    this.saveDebounceMs = 1000; // Debounce saves to prevent excessive disk writes

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
    const dir = path.dirname(genomePath);
    const basename = path.basename(genomePath, path.extname(genomePath));

    return path.join(dir, `${basename}.CodeXomics`);
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

  /**
   * Save sidecar data for a genome file (debounced)
   * @param {string} genomePath - Path to the genome file
   * @param {Object} data - The data to save
   */
  async save(genomePath, data = null) {
    if (!genomePath) {
      console.warn('⚠️ SidecarManager.save called with no genomePath');
      return;
    }

    return this._withWriteLock(genomePath, () => this._scheduleSave(genomePath, data));
  }

  async _scheduleSave(genomePath, data = null) {
    const clone = input => {
      if (typeof structuredClone === 'function') return structuredClone(input);
      return JSON.parse(JSON.stringify(input));
    };

    // Use cached data if no data provided
    if (!data) {
      data = this.cache.get(genomePath) || this.getDefaultData(genomePath);
    }

    // Update cache
    data = clone(data);
    data.lastModified = new Date().toISOString();
    this.cache.set(genomePath, data);

    // Clear existing debounce timer
    if (this.pendingSaves.has(genomePath)) {
      clearTimeout(this.pendingSaves.get(genomePath));
    }

    // Debounce the actual file write
    const timeoutId = setTimeout(async () => {
      try {
        await this._withWriteLock(genomePath, async () => {
          const cached = this.cache.get(genomePath);
          if (!cached) return;
          await this._performSave(genomePath, clone(cached));
        });
      } finally {
        if (this.pendingSaves.get(genomePath) === timeoutId) {
          this.pendingSaves.delete(genomePath);
        }
      }
    }, this.saveDebounceMs);

    this.pendingSaves.set(genomePath, timeoutId);
  }

  /**
   * Perform the actual save operation
   * @private
   */
  async _performSave(genomePath, data, options = {}) {
    try {
      if (!window.electronAPI || typeof window.electronAPI.saveSidecarFile !== 'function') {
        const unavailableError = new Error('Sidecar file API unavailable');
        if (options.throwOnError) throw unavailableError;
        return false;
      }

      const result = await window.electronAPI.saveSidecarFile(genomePath, data);
      if (!result || !result.success) {
        const saveError = new Error(result?.error || 'Sidecar file API unavailable');
        if (result?.conflict || result?.code === 'SIDECAR_CONFLICT') {
          saveError.code = 'SIDECAR_CONFLICT';
          saveError.currentRevision = result.currentRevision;
        }
        throw saveError;
      }

      if (Number.isInteger(result.storageRevision) && result.storageRevision >= 0) {
        data._storageRevision = result.storageRevision;
        const cached = this.cache.get(genomePath);
        const sentRevision = Number.isInteger(cached?._storageRevision) ? cached._storageRevision : 0;
        const expectedRevision = Number.isInteger(data._storageRevision) ? data._storageRevision - 1 : 0;
        if (cached && sentRevision === expectedRevision) {
          cached._storageRevision = result.storageRevision;
        }
      }

      console.log(`💾 Saved sidecar data to: ${result.path || this.getSidecarPath(genomePath)}`);
      this.cacheProvenance.set(genomePath, 'verified');
    } catch (error) {
      console.error(`❌ Error saving sidecar file: ${error.message}`);
      if (error.code === 'SIDECAR_CONFLICT') {
        this.cache.delete(genomePath);
        this.cacheProvenance.delete(genomePath);
      }
      if (options.throwOnError) throw error;
      return false;
    }
    return true;
  }

  /**
   * Fallback save to app data directory when original location is not writable
   * @private
   */
  async _saveFallback(genomePath, data) {
    await this._withWriteLock(genomePath, () =>
      this._performSave(genomePath, {
        ...(data || {}),
        _originalPath: genomePath,
      })
    );
  }

  /**
   * Get a specific key from sidecar data
   * @param {string} genomePath - Path to the genome file
   * @param {string} key - The key to retrieve (e.g., 'geneNotes', 'geneAttachments')
   * @returns {Promise<any>} The value for the key
   */
  async get(genomePath, key, options = {}) {
    const data = await this.load(genomePath, options);
    return data[key] || {};
  }

  /**
   * Set a specific key in sidecar data
   * @param {string} genomePath - Path to the genome file
   * @param {string} key - The key to set
   * @param {any} value - The value to store
   */
  async set(genomePath, key, value) {
    return this._withWriteLock(genomePath, async () => {
      const data = await this.load(genomePath);
      data[key] = value;
      await this._scheduleSave(genomePath, data);
    });
  }

  async setAndForceSave(genomePath, key, value) {
    return this._withWriteLock(genomePath, () => this._setAndForceSave(genomePath, key, value));
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

  async _setAndForceSave(genomePath, key, value) {
    if (!genomePath) throw new Error('setAndForceSave requires a genome path');
    const hadCachedData = this.cache.has(genomePath);
    const previousProvenance = this.cacheProvenance.get(genomePath);
    const previousData = await this.load(genomePath, { strict: true });
    const clone = input => {
      if (typeof structuredClone === 'function') return structuredClone(input);
      return JSON.parse(JSON.stringify(input));
    };
    const previousSnapshot = clone(previousData);
    const candidate = clone(previousData);
    candidate[key] = clone(value);
    candidate.lastModified = new Date().toISOString();

    if (this.pendingSaves.has(genomePath)) {
      clearTimeout(this.pendingSaves.get(genomePath));
      this.pendingSaves.delete(genomePath);
    }
    this.cache.set(genomePath, candidate);
    try {
      await this._performSave(genomePath, candidate, { throwOnError: true });
    } catch (error) {
      if (error.code === 'SIDECAR_CONFLICT') {
        this.cache.delete(genomePath);
        this.cacheProvenance.delete(genomePath);
      } else if (hadCachedData) {
        this.cache.set(genomePath, previousSnapshot);
        this.cacheProvenance.set(genomePath, previousProvenance);
      } else {
        this.cache.delete(genomePath);
        this.cacheProvenance.delete(genomePath);
      }
      throw error;
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
    } else {
      this.cache.clear();
      this.cacheProvenance.clear();
    }
  }

  /**
   * Force immediate save (bypass debounce)
   * @param {string} genomePath - Path to the genome file
   */
  async forceSave(genomePath) {
    return this._withWriteLock(genomePath, async () => {
      if (this.pendingSaves.has(genomePath)) {
        clearTimeout(this.pendingSaves.get(genomePath));
        this.pendingSaves.delete(genomePath);
      }

      const data = this.cache.get(genomePath);
      if (data) {
        const snapshot =
          typeof structuredClone === 'function' ? structuredClone(data) : JSON.parse(JSON.stringify(data));
        await this._performSave(genomePath, snapshot, { throwOnError: true });
      }
    });
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
