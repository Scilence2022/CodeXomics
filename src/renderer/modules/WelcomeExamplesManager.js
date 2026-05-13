/**
 * WelcomeExamplesManager
 * Manages the welcome screen example prompts stored in localStorage.
 * Provides CRUD operations for categories and their example items.
 */
class WelcomeExamplesManager {
  static STORAGE_KEY = 'codexomics_welcome_examples';

  static DEFAULT_EXAMPLES = [
    {
      id: 'nav-search',
      icon: '🔍',
      title: 'Navigation & Search',
      cssClass: 'welcome-card-search',
      examples: [
        { title: 'Navigate to E. coli origin of replication', prompt: 'Navigate to E. coli origin of replication' },
        { title: 'Search for DNA polymerase genes', prompt: 'Search for DNA polymerase genes' },
        { title: 'Find genes near position 123456', prompt: 'Find genes near position 123456' },
      ],
    },
    {
      id: 'mol-bio',
      icon: '🧪',
      title: 'Molecular Biology',
      cssClass: 'welcome-card-molbio',
      examples: [
        { title: 'Find EcoRI restriction sites in this region', prompt: 'Find EcoRI restriction sites in this region' },
        { title: 'Virtual digest with EcoRI and BamHI', prompt: 'Virtual digest with EcoRI and BamHI' },
        { title: 'Search for TATAAA promoter motifs', prompt: 'Search for TATAAA promoter motifs' },
      ],
    },
    {
      id: 'seq-analysis',
      icon: '📊',
      title: 'Sequence Analysis',
      cssClass: 'welcome-card-analysis',
      examples: [
        { title: 'What is the GC content of the current view?', prompt: 'What is the GC content of the current view?' },
        { title: 'Analyze codon usage in the lacZ gene', prompt: 'Analyze codon usage in the lacZ gene' },
        { title: 'Find all ORFs longer than 300bp', prompt: 'Find all ORFs longer than 300bp' },
      ],
    },
    {
      id: 'org-export',
      icon: '🔖',
      title: 'Organization & Export',
      cssClass: 'welcome-card-export',
      examples: [
        { title: 'Bookmark this interesting region', prompt: 'Bookmark this interesting region' },
        { title: 'Export features from current view', prompt: 'Export features from current view' },
        { title: 'Show file information summary', prompt: 'Show file information summary' },
      ],
    },
  ];

  constructor() {
    /** @type {Function|null} Called whenever data changes so the welcome UI can re-render */
    this._onChangeCallback = null;
  }

  /**
   * Register a callback that fires whenever examples data changes.
   * @param {Function} callback
   */
  onChange(callback) {
    this._onChangeCallback = callback;
  }

  /** Notify observers of a data change */
  _notifyChange() {
    if (typeof this._onChangeCallback === 'function') {
      this._onChangeCallback(this.getAll());
    }
  }

  /**
   * Return the full list of categories. Falls back to defaults when no data is stored.
   * @returns {Array<{id:string, icon:string, title:string, cssClass:string, examples:string[]}>}
   */
  getAll() {
    try {
      const raw = localStorage.getItem(WelcomeExamplesManager.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Backward compatibility: Convert string examples to {title, prompt} objects
          return parsed.map(cat => {
            if (cat.examples) {
              cat.examples = cat.examples.map(ex => {
                if (typeof ex === 'string') {
                  return { title: ex, prompt: ex };
                }
                return ex;
              });
            }
            return cat;
          });
        }
      }
    } catch (err) {
      console.warn('[WelcomeExamplesManager] Failed to parse localStorage data:', err);
    }
    return JSON.parse(JSON.stringify(WelcomeExamplesManager.DEFAULT_EXAMPLES));
  }

  /**
   * Persist the full list of categories.
   * @param {Array} categories
   */
  saveAll(categories) {
    try {
      localStorage.setItem(WelcomeExamplesManager.STORAGE_KEY, JSON.stringify(categories));
      this._notifyChange();
    } catch (err) {
      console.error('[WelcomeExamplesManager] Failed to save to localStorage:', err);
    }
  }

  /**
   * Add a new category.
   * @param {{icon:string, title:string, cssClass:string}} opts
   * @returns {string} id of the new category
   */
  addCategory({ icon = '💬', title = 'New Category', cssClass = 'welcome-card-search' } = {}) {
    const categories = this.getAll();
    const id = `cat-${Date.now()}`;
    categories.push({ id, icon, title, cssClass, examples: [] });
    this.saveAll(categories);
    return id;
  }

  /**
   * Update a category's metadata (icon / title / cssClass).
   * @param {string} categoryId
   * @param {{icon?:string, title?:string, cssClass?:string}} updates
   * @returns {boolean}
   */
  updateCategory(categoryId, updates) {
    const categories = this.getAll();
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return false;
    if (updates.icon !== undefined) cat.icon = updates.icon;
    if (updates.title !== undefined) cat.title = updates.title;
    if (updates.cssClass !== undefined) cat.cssClass = updates.cssClass;
    this.saveAll(categories);
    return true;
  }

  /**
   * Delete a category by id.
   * @param {string} categoryId
   * @returns {boolean}
   */
  deleteCategory(categoryId) {
    const categories = this.getAll();
    const idx = categories.findIndex(c => c.id === categoryId);
    if (idx === -1) return false;
    categories.splice(idx, 1);
    this.saveAll(categories);
    return true;
  }

  /**
   * Add an example prompt to a category.
   * @param {string} categoryId
   * @param {string} promptText
   * @returns {boolean}
   */
  addExample(categoryId, promptText) {
    const text = (promptText || '').trim();
    if (!text) return false;
    const categories = this.getAll();
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return false;
    cat.examples.push(text);
    this.saveAll(categories);
    return true;
  }

  /**
   * Update an example prompt within a category.
   * @param {string} categoryId
   * @param {number} index
   * @param {string} newText
   * @returns {boolean}
   */
  updateExample(categoryId, index, newText) {
    const text = (newText || '').trim();
    if (!text) return false;
    const categories = this.getAll();
    const cat = categories.find(c => c.id === categoryId);
    if (!cat || index < 0 || index >= cat.examples.length) return false;
    cat.examples[index] = text;
    this.saveAll(categories);
    return true;
  }

  /**
   * Remove an example prompt from a category.
   * @param {string} categoryId
   * @param {number} index
   * @returns {boolean}
   */
  deleteExample(categoryId, index) {
    const categories = this.getAll();
    const cat = categories.find(c => c.id === categoryId);
    if (!cat || index < 0 || index >= cat.examples.length) return false;
    cat.examples.splice(index, 1);
    this.saveAll(categories);
    return true;
  }

  /**
   * Reorder categories.
   * @param {string[]} orderedIds
   */
  reorderCategories(orderedIds) {
    const categories = this.getAll();
    const map = new Map(categories.map(c => [c.id, c]));
    const reordered = orderedIds.map(id => map.get(id)).filter(Boolean);
    // Append any not present in the id list (safety)
    categories.forEach(c => {
      if (!orderedIds.includes(c.id)) reordered.push(c);
    });
    this.saveAll(reordered);
  }

  /**
   * Reset to factory defaults and notify.
   */
  resetToDefaults() {
    localStorage.removeItem(WelcomeExamplesManager.STORAGE_KEY);
    this._notifyChange();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WelcomeExamplesManager;
}
