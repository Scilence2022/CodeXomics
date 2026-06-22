/**
 * SidecarManager - Manages per-file metadata storage using companion sidecar files
 *
 * For each genome file (e.g., mygenome.gbk), a sidecar file is created
 * (e.g., mygenome.CodeXomics) to store gene notes, attachments, and other metadata.
 */
class SidecarManager {
  constructor() {
    this.cache = new Map(); // Cache loaded sidecar data by file path
    this.pendingSaves = new Map(); // Track pending save operations
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
  async load(genomePath) {
    if (!genomePath) {
      console.warn('⚠️ SidecarManager.load called with no genomePath');
      return this.getDefaultData();
    }

    // Return cached data if available
    if (this.cache.has(genomePath)) {
      return this.cache.get(genomePath);
    }

    try {
      if (!window.electronAPI || typeof window.electronAPI.loadSidecarFile !== 'function') {
        const defaultData = this.getDefaultData(genomePath);
        this.cache.set(genomePath, defaultData);
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
        return defaultData;
      }

      const data = result.data || this.getDefaultData(genomePath);

      console.log(`📂 Loaded sidecar data from: ${result.path || this.getSidecarPath(genomePath)}`);
      this.cache.set(genomePath, data);
      return data;
    } catch (error) {
      console.error(`❌ Error loading sidecar file: ${error.message}`);
      return this.getDefaultData(genomePath);
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

    // Use cached data if no data provided
    if (!data) {
      data = this.cache.get(genomePath) || this.getDefaultData(genomePath);
    }

    // Update cache
    data.lastModified = new Date().toISOString();
    this.cache.set(genomePath, data);

    // Clear existing debounce timer
    if (this.pendingSaves.has(genomePath)) {
      clearTimeout(this.pendingSaves.get(genomePath));
    }

    // Debounce the actual file write
    const timeoutId = setTimeout(async () => {
      await this._performSave(genomePath, data);
      this.pendingSaves.delete(genomePath);
    }, this.saveDebounceMs);

    this.pendingSaves.set(genomePath, timeoutId);
  }

  /**
   * Perform the actual save operation
   * @private
   */
  async _performSave(genomePath, data) {
    try {
      if (!window.electronAPI || typeof window.electronAPI.saveSidecarFile !== 'function') {
        return;
      }

      const result = await window.electronAPI.saveSidecarFile(genomePath, data);
      if (!result || !result.success) {
        throw new Error(result?.error || 'Sidecar file API unavailable');
      }

      console.log(`💾 Saved sidecar data to: ${result.path || this.getSidecarPath(genomePath)}`);
    } catch (error) {
      console.error(`❌ Error saving sidecar file: ${error.message}`);
    }
  }

  /**
   * Fallback save to app data directory when original location is not writable
   * @private
   */
  async _saveFallback(genomePath, data) {
    await this._performSave(genomePath, {
      ...(data || {}),
      _originalPath: genomePath,
    });
  }

  /**
   * Get a specific key from sidecar data
   * @param {string} genomePath - Path to the genome file
   * @param {string} key - The key to retrieve (e.g., 'geneNotes', 'geneAttachments')
   * @returns {Promise<any>} The value for the key
   */
  async get(genomePath, key) {
    const data = await this.load(genomePath);
    return data[key] || {};
  }

  /**
   * Set a specific key in sidecar data
   * @param {string} genomePath - Path to the genome file
   * @param {string} key - The key to set
   * @param {any} value - The value to store
   */
  async set(genomePath, key, value) {
    const data = await this.load(genomePath);
    data[key] = value;
    await this.save(genomePath, data);
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
    } else {
      this.cache.clear();
    }
  }

  /**
   * Force immediate save (bypass debounce)
   * @param {string} genomePath - Path to the genome file
   */
  async forceSave(genomePath) {
    if (this.pendingSaves.has(genomePath)) {
      clearTimeout(this.pendingSaves.get(genomePath));
      this.pendingSaves.delete(genomePath);
    }

    const data = this.cache.get(genomePath);
    if (data) {
      await this._performSave(genomePath, data);
    }
  }

  /**
   * Simple string hash for fallback filename generation
   * @private
   */
  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
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
