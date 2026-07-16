/**
 * GeneNotesManager - Manages notes for genes
 * Allows users to create, edit, and save notes for each gene
 */

class GeneNotesManager {
  constructor(genomeBrowser, configManager, sidecarManager = null) {
    this.genomeBrowser = genomeBrowser;
    this.configManager = configManager;
    this.sidecarManager = sidecarManager;
    this.notes = new Map(); // geneId -> note object
    this.currentGeneId = null;
    this.isNotesVisible = false;

    this.init();
  }

  /**
   * Initialize the manager and load saved notes
   */
  async init() {
    try {
      await this.loadNotes();
      console.log('📝 GeneNotesManager initialized');
    } catch (error) {
      console.error('Error initializing GeneNotesManager:', error);
    }
  }

  /**
   * Get the gene identifier from a gene object
   */
  getGeneIdentifier(gene) {
    if (!gene) return null;

    const locusTag = gene.qualifiers?.locus_tag;
    const geneName = gene.qualifiers?.gene;

    if (locusTag) return locusTag;
    if (geneName) return geneName;

    return `${gene.type}_${gene.start}_${gene.end}`;
  }

  /**
   * Get note for a specific gene
   */
  getNote(geneId) {
    if (!geneId) return null;
    return this.notes.get(geneId) || null;
  }

  /**
   * Save note for a gene
   */
  async saveNote(geneId, content) {
    if (!geneId) return false;

    try {
      const note = {
        geneId: geneId,
        content: content,
        createdAt: this.notes.get(geneId)?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (content.trim() === '') {
        // Delete empty notes
        this.notes.delete(geneId);
      } else {
        this.notes.set(geneId, note);
      }

      await this.persistNotes();
      this.showNotification('Note saved', 'success');
      return true;
    } catch (error) {
      console.error('Error saving note:', error);
      this.showNotification('Failed to save note', 'error');
      return false;
    }
  }

  /**
   * Delete note for a gene
   */
  async deleteNote(geneId) {
    if (!geneId || !this.notes.has(geneId)) return false;

    try {
      this.notes.delete(geneId);
      await this.persistNotes();
      this.showNotification('Note deleted', 'success');
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      this.showNotification('Failed to delete note', 'error');
      return false;
    }
  }

  /**
   * Persist notes to sidecar file (or fallback to ConfigManager)
   */
  async persistNotes() {
    try {
      const data = {};
      for (const [geneId, note] of this.notes) {
        data[geneId] = note;
      }

      // Use sidecar manager if available and file is loaded
      const currentFilePath = this.genomeBrowser?.fileManager?.currentFile?.path;
      if (this.sidecarManager && currentFilePath) {
        await this.sidecarManager.set(currentFilePath, 'geneNotes', data);
        console.log('💾 Notes saved to sidecar file');
      } else if (this.configManager) {
        // Fallback to ConfigManager (legacy behavior)
        this.configManager.set('geneNotes.data', data);
        console.log('💾 Notes saved to config (fallback)');
      }
    } catch (error) {
      console.error('Error persisting notes:', error);
    }
  }

  /**
   * Load notes from sidecar file (or fallback to ConfigManager)
   */
  async loadNotes() {
    try {
      let data = {};

      // Use sidecar manager if available and file is loaded
      const currentFilePath = this.genomeBrowser?.fileManager?.currentFile?.path;
      if (this.sidecarManager && currentFilePath) {
        data = (await this.sidecarManager.get(currentFilePath, 'geneNotes')) || {};
        console.log(`📂 Loading notes from sidecar file: ${currentFilePath}`);
      } else if (this.configManager) {
        // Fallback to ConfigManager (legacy behavior)
        data = this.configManager.get('geneNotes.data', {});
        console.log('📂 Loading notes from config (fallback)');
      }

      this.notes.clear();
      for (const [geneId, note] of Object.entries(data)) {
        if (note && note.content) {
          this.notes.set(geneId, note);
        }
      }

      console.log(`📂 Loaded notes for ${this.notes.size} genes`);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  }

  /**
   * Reload notes for the current file (call when file changes)
   */
  async reloadForFile() {
    await this.loadNotes();
  }

  /**
   * Render notes section HTML for a gene
   */
  renderNotesSection(geneId) {
    const note = this.getNote(geneId);
    const content = note?.content || '';
    const hasNote = content.trim() !== '';
    const escapedGeneId = geneId.replace(/'/g, "\\'");

    return `
            <div class="gene-notes-section">
                <div class="gene-notes-header">
                    <h4><i class="fas fa-sticky-note"></i> Curator Notes</h4>
                    <div class="gene-notes-header-actions">
                        ${
                          hasNote
                            ? `
                            <span class="gene-notes-updated">
                                Updated ${this.formatDate(note.updatedAt)}
                            </span>
                        `
                            : ''
                        }
                    </div>
                </div>
                <div class="gene-notes-content">
                    <textarea 
                        id="geneNoteTextarea" 
                        class="gene-notes-textarea" 
                        placeholder="Add private curator notes about this gene..."
                        onblur="window.genomeBrowser.saveGeneNote('${escapedGeneId}')"
                    >${this.escapeHtml(content)}</textarea>
                </div>
            </div>
        `;
  }

  /**
   * Format date for display
   */
  formatDate(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '';
    }
  }

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show notification using genome browser's method
   */
  showNotification(message, type = 'info') {
    if (this.genomeBrowser && typeof this.genomeBrowser.showNotification === 'function') {
      this.genomeBrowser.showNotification(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Get total note count
   */
  getTotalNoteCount() {
    return this.notes.size;
  }

  /**
   * Check if a gene has notes
   */
  hasNote(geneId) {
    const note = this.notes.get(geneId);
    return note && note.content && note.content.trim() !== '';
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeneNotesManager;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.GeneNotesManager = GeneNotesManager;
}
