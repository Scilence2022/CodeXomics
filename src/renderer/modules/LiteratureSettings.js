/**
 * LiteratureSettings - Manages settings for the literature citation display
 * Handles page size configuration and settings persistence
 */
class LiteratureSettings {
  constructor() {
    this.storageKey = 'genomeBrowser_literatureSettings';
    this.defaults = {
      pageSize: 10,
    };
    this.settings = { ...this.defaults };
    this.loadSettings();
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...this.defaults, ...parsed };
      }
    } catch (error) {
      console.error('Error loading literature settings:', error);
      this.settings = { ...this.defaults };
    }
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
      console.log('Literature settings saved:', this.settings);
    } catch (error) {
      console.error('Error saving literature settings:', error);
    }
  }

  /**
   * Get current page size
   * @returns {number} Page size
   */
  getPageSize() {
    return this.settings.pageSize;
  }

  /**
   * Set page size
   * @param {number} size - New page size
   */
  setPageSize(size) {
    const validSize = Math.max(5, Math.min(50, parseInt(size) || 10));
    this.settings.pageSize = validSize;
    this.saveSettings();
  }

  /**
   * Reset to default settings
   */
  resetToDefaults() {
    this.settings = { ...this.defaults };
    this.saveSettings();
  }

  /**
   * Generate settings modal HTML
   * @returns {string} HTML for settings modal
   */
  generateSettingsModalHTML() {
    return `
            <div class="literature-settings-modal-overlay" id="literatureSettingsModal">
                <div class="literature-settings-modal">
                    <div class="literature-settings-header">
                        <h4>Literature Display Settings</h4>
                        <button class="literature-settings-close" onclick="window.literatureSettings.closeModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="literature-settings-body">
                        <div class="literature-setting-item">
                            <label for="literaturePageSize">Items per page:</label>
                            <input type="number" 
                                   id="literaturePageSize" 
                                   min="5" 
                                   max="50" 
                                   value="${this.settings.pageSize}"
                                   class="literature-setting-input">
                            <span class="literature-setting-hint">Range: 5-50</span>
                        </div>
                    </div>
                    <div class="literature-settings-footer">
                        <button class="literature-settings-btn secondary" onclick="window.literatureSettings.resetToDefaults(); window.literatureSettings.closeModal();">
                            Reset to Defaults
                        </button>
                        <button class="literature-settings-btn primary" onclick="window.literatureSettings.applyAndClose()">
                            Apply
                        </button>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Show settings modal
   */
  showModal() {
    // Remove existing modal if present
    const existingModal = document.getElementById('literatureSettingsModal');
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', this.generateSettingsModalHTML());

    // Focus on input
    setTimeout(() => {
      const input = document.getElementById('literaturePageSize');
      if (input) input.focus();
    }, 100);
  }

  /**
   * Close settings modal
   */
  closeModal() {
    const modal = document.getElementById('literatureSettingsModal');
    if (modal) {
      modal.remove();
    }
  }

  /**
   * Apply settings and close modal
   */
  applyAndClose() {
    const input = document.getElementById('literaturePageSize');
    if (input) {
      this.setPageSize(parseInt(input.value));
    }
    this.closeModal();

    // Trigger refresh of citation display
    if (window.enhancedCitationDisplay) {
      window.enhancedCitationDisplay.onSettingsChanged();
    }
  }

  /**
   * Add settings modal CSS styles
   */
  addSettingsStyles() {
    if (document.getElementById('literature-settings-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'literature-settings-styles';
    style.textContent = `
            .literature-settings-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .literature-settings-modal {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
                width: 320px;
                max-width: 90%;
            }

            .literature-settings-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid #dee2e6;
            }

            .literature-settings-header h4 {
                margin: 0;
                font-size: 14px;
                font-weight: 600;
                color: #212529;
            }

            .literature-settings-close {
                background: none;
                border: none;
                color: #6c757d;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s;
            }

            .literature-settings-close:hover {
                background: #f8f9fa;
                color: #212529;
            }

            .literature-settings-body {
                padding: 16px;
            }

            .literature-setting-item {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .literature-setting-item label {
                font-size: 13px;
                font-weight: 500;
                color: #495057;
            }

            .literature-setting-input {
                padding: 8px 12px;
                border: 1px solid #ced4da;
                border-radius: 4px;
                font-size: 14px;
                width: 100%;
                box-sizing: border-box;
            }

            .literature-setting-input:focus {
                border-color: #007bff;
                outline: none;
                box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.15);
            }

            .literature-setting-hint {
                font-size: 11px;
                color: #6c757d;
            }

            .literature-settings-footer {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                padding: 12px 16px;
                border-top: 1px solid #dee2e6;
            }

            .literature-settings-btn {
                padding: 6px 14px;
                border-radius: 4px;
                font-size: 13px;
                cursor: pointer;
                border: 1px solid;
                transition: all 0.2s;
            }

            .literature-settings-btn.primary {
                background: #007bff;
                border-color: #007bff;
                color: white;
            }

            .literature-settings-btn.primary:hover {
                background: #0056b3;
                border-color: #0056b3;
            }

            .literature-settings-btn.secondary {
                background: white;
                border-color: #ced4da;
                color: #495057;
            }

            .literature-settings-btn.secondary:hover {
                background: #f8f9fa;
            }
        `;
    document.head.appendChild(style);
  }

  /**
   * Initialize the settings manager
   */
  init() {
    this.addSettingsStyles();
    console.log('LiteratureSettings initialized with page size:', this.settings.pageSize);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LiteratureSettings;
}
// Always expose to window immediately
if (typeof window !== 'undefined') {
  window.LiteratureSettings = LiteratureSettings;
  window.literatureSettings = new LiteratureSettings();
  window.literatureSettings.init();
  console.log('LiteratureSettings class registered on window object');
}
