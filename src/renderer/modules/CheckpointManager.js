/**
 * CheckpointManager - Manages system state checkpoints for rollback functionality
 * Handles creation, storage, restoration, and management of application checkpoints
 *
 * Checkpoints belong to the loaded genome file. The main-process checkpoint store owns them
 * (src/main/checkpoint-store.js), so every genome view with the same file open shares one list,
 * and views of other files never see it. `this.checkpoints` mirrors the store's list for
 * `this.genomePath`.
 */
class CheckpointManager {
  static LEGACY_STORAGE_KEY = 'genomeai_checkpoints';

  constructor(genomeBrowser, { storeApi = null } = {}) {
    this.genomeBrowser = genomeBrowser;
    // IPC bridge to the checkpoint store (window.electronAPI; injectable for tests)
    this.storeApi = storeApi || (typeof window !== 'undefined' ? window.electronAPI : null) || null;
    this.checkpoints = [];
    this.genomePath = null; // Genome whose store list `this.checkpoints` currently mirrors
    this.autoSaveInterval = 300000; // Auto-save every 5 minutes
    this.autoSaveTimer = null;

    // Checkpoint types
    this.CHECKPOINT_TYPES = {
      MANUAL: 'manual',
      AUTO: 'auto',
      BEFORE_ACTION: 'before_action',
      MILESTONE: 'milestone',
    };

    this.initializeEventListeners();
    this.listenForStoreChanges();
    this.startAutoSave();
    // Resolves once legacy checkpoints are imported and the current genome's list is loaded.
    this.ready = this.importLegacyCheckpoints().then(() => this.refresh());

    console.log('✅ CheckpointManager initialized');
  }

  /**
   * Genome file the checkpoints belong to: the FASTA/GenBank source of this view
   */
  getCurrentGenomePath() {
    return this.genomeBrowser.loadedGenomePath || null;
  }

  /**
   * Call the main-process checkpoint store
   */
  async invokeStore(channel, params) {
    if (!this.storeApi?.invoke) throw new Error('Checkpoints require the desktop application');

    const result = await this.storeApi.invoke(channel, params);
    if (!result?.success) throw new Error(result?.error || `Checkpoint store request failed: ${channel}`);
    return result;
  }

  /**
   * Adopt a list returned by the store, unless this view has since switched genomes
   */
  applyStoreList(genomePath, checkpoints) {
    if (genomePath !== this.getCurrentGenomePath()) return false;

    this.genomePath = genomePath;
    this.checkpoints = (checkpoints || []).map(cp => ({ ...cp, timestamp: new Date(cp.timestamp) }));
    this.updateCheckpointListUI();
    return true;
  }

  /**
   * Reload the current genome's checkpoints from the store
   */
  async refresh() {
    const genomePath = this.getCurrentGenomePath();
    if (!genomePath) {
      this.genomePath = null;
      this.checkpoints = [];
      this.updateCheckpointListUI();
      return;
    }

    try {
      const result = await this.invokeStore('checkpoints:list', { genomePath });
      this.applyStoreList(genomePath, result.checkpoints);
    } catch (error) {
      console.error('❌ Error loading checkpoints:', error);
    }
  }

  /**
   * Make sure `this.checkpoints` belongs to the genome that is loaded now
   */
  async syncWithCurrentGenome() {
    if (this.genomePath !== this.getCurrentGenomePath()) {
      await this.refresh();
    }
  }

  /**
   * Reload when another genome view changes this genome's checkpoints
   */
  listenForStoreChanges() {
    if (!this.storeApi?.on) return;

    this.storeApi.on('checkpoints:changed', payload => {
      if (payload?.genomePath && payload.genomePath === this.getCurrentGenomePath()) {
        this.refresh();
      }
    });
  }

  /**
   * Initialize event listeners for checkpoint UI
   */
  initializeEventListeners() {
    // Wait for DOM to be ready
    const setupListeners = () => {
      console.log('🎯 Setting up CheckpointManager event listeners...');

      // Modal checkpoint creation button
      const createCheckpointBtnModal = document.getElementById('createCheckpointBtnModal');
      if (createCheckpointBtnModal) {
        createCheckpointBtnModal.addEventListener('click', () => {
          this.createManualCheckpointFromModal();
        });
        console.log('✅ Modal checkpoint creation listener added');
      }

      // Checkpoint name input - Enter key
      const checkpointNameInput = document.getElementById('checkpointNameInput');
      if (checkpointNameInput) {
        checkpointNameInput.addEventListener('keypress', e => {
          if (e.key === 'Enter') {
            this.createManualCheckpointFromModal();
          }
        });
        console.log('✅ Checkpoint name input listener added');
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupListeners);
    } else {
      setupListeners();
    }
  }

  /**
   * Create a manual checkpoint with user-provided name
   */
  async createManualCheckpoint() {
    if (!this.getCurrentGenomePath()) {
      this.genomeBrowser.showNotification('Load a genome before creating a checkpoint', 'warning');
      return null;
    }

    try {
      const name = await this.promptForCheckpointName();
      if (!name) return null;

      const checkpointId = await this.createCheckpoint(name, this.CHECKPOINT_TYPES.MANUAL);
      this.genomeBrowser.showNotification(`Checkpoint "${name}" created successfully`, 'success');
      return checkpointId;
    } catch (error) {
      console.error('❌ Error creating manual checkpoint:', error);
      this.genomeBrowser.showNotification('Failed to create checkpoint', 'error');
      return null;
    }
  }

  /**
   * Create checkpoint from modal input
   */
  async createManualCheckpointFromModal() {
    const nameInput = document.getElementById('checkpointNameInput');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
      this.genomeBrowser.showNotification('Please enter a checkpoint name', 'warning');
      return;
    }

    if (!this.getCurrentGenomePath()) {
      this.genomeBrowser.showNotification('Load a genome before creating a checkpoint', 'warning');
      return;
    }

    try {
      const checkpointId = await this.createCheckpoint(name, this.CHECKPOINT_TYPES.MANUAL);
      this.genomeBrowser.showNotification(`Checkpoint "${name}" created successfully`, 'success');
      nameInput.value = ''; // Clear input
      this.updateCheckpointListUI();
      return checkpointId;
    } catch (error) {
      console.error('❌ Error creating checkpoint from modal:', error);
      this.genomeBrowser.showNotification('Failed to create checkpoint', 'error');
    }
  }

  /**
   * Create a new checkpoint
   */
  async createCheckpoint(name, type = this.CHECKPOINT_TYPES.MANUAL, metadata = {}, capturedState = null) {
    try {
      // Generate unique name if not provided
      if (!name) {
        name = this.generateCheckpointName(type);
      }

      const genomePath = this.getCurrentGenomePath();
      if (!genomePath) {
        throw new Error('Load a genome before creating a checkpoint');
      }

      // Capture current system state (auto checkpoints pass the state they already compared)
      const state = capturedState || (await this.captureSystemState());

      // Create checkpoint object; the store assigns its id and applies the limits
      const checkpoint = {
        name: name,
        type: type,
        timestamp: new Date().toISOString(),
        state: state,
        metadata: metadata,
        size: this.calculateStateSize(state),
      };

      const result = await this.invokeStore('checkpoints:add', { genomePath, checkpoints: [checkpoint] });
      if (result.rejected?.length) {
        throw new Error(`Checkpoint "${name}" is too large to save`);
      }

      this.applyStoreList(genomePath, result.checkpoints);

      const checkpointId = result.added[0];
      console.log(`✅ Checkpoint created: ${name} (ID: ${checkpointId})`);
      return checkpointId;
    } catch (error) {
      console.error('❌ Error creating checkpoint:', error);
      throw error;
    }
  }

  /**
   * Capture current system state
   */
  async captureSystemState() {
    const state = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',

      // Genome Browser State
      genomeBrowser: {
        currentFile: this.summarizeCurrentFile(this.genomeBrowser.currentFile),
        currentChromosome: this.genomeBrowser.currentChromosome,
        currentPosition: this.genomeBrowser.currentPosition,
        zoomLevel: this.genomeBrowser.zoomLevel,
        viewStart: this.genomeBrowser.viewStart,
        viewEnd: this.genomeBrowser.viewEnd,
        loadedFiles: this.genomeBrowser.loadedFiles ? [...this.genomeBrowser.loadedFiles] : [],
        selectedFeatures: this.genomeBrowser.selectedFeatures ? [...this.genomeBrowser.selectedFeatures] : [],
      },

      // Action Manager State
      actionManager: window.actionManager ? window.actionManager.getState() : null,

      // UI State
      ui: {
        activeModal: this.getActiveModal(),
        panelStates: this.capturePanelStates(),
        trackSettings: this.captureTrackSettings(),
        viewMode: this.captureViewMode(),
      },

      // File Manager State
      fileManager: this.captureFileManagerState(),

      // Plugin States
      plugins: this.capturePluginStates(),

      // Settings
      settings: this.captureSettings(),
    };

    return state;
  }

  /**
   * Describe the current file by reference only. Loaders such as the operon loader attach the whole
   * parsed file as `data`; copying that into every checkpoint is what grew storage to tens of MB,
   * and rollback never reloads it anyway.
   */
  summarizeCurrentFile(currentFile) {
    if (!currentFile || typeof currentFile !== 'object') {
      return currentFile || null;
    }

    return {
      path: currentFile.path || null,
      type: currentFile.type || null,
      info: currentFile.info || null,
    };
  }

  /**
   * Serialize a state for equality checks, ignoring when it was captured
   */
  getStateSignature(state) {
    if (!state) return '';
    return JSON.stringify({ ...state, timestamp: undefined });
  }

  /**
   * Capture panel states
   */
  capturePanelStates() {
    const panels = [
      'fileInfoSection',
      'navigationSection',
      'statisticsSection',
      'tracksSection',
      'featuresSection',
      'bookmarksSection',
    ];

    const states = {};
    panels.forEach(panelId => {
      const panel = document.getElementById(panelId);
      if (panel) {
        states[panelId] = {
          visible: !panel.classList.contains('hidden'),
          collapsed: panel.classList.contains('collapsed'),
        };
      }
    });

    return states;
  }

  /**
   * Capture track settings
   */
  captureTrackSettings() {
    if (this.genomeBrowser.trackSettings) {
      return JSON.parse(JSON.stringify(this.genomeBrowser.trackSettings));
    }
    return null;
  }

  /**
   * Capture view mode
   */
  captureViewMode() {
    return {
      sequenceMode: this.genomeBrowser.sequenceMode || 'nucleotide',
      displayMode: this.genomeBrowser.displayMode || 'normal',
    };
  }

  /**
   * Capture file manager state
   */
  captureFileManagerState() {
    if (this.genomeBrowser.fileManager) {
      return {
        recentFiles: this.genomeBrowser.fileManager.recentFiles ? [...this.genomeBrowser.fileManager.recentFiles] : [],
        fileHistory: this.genomeBrowser.fileManager.fileHistory ? [...this.genomeBrowser.fileManager.fileHistory] : [],
      };
    }
    return null;
  }

  /**
   * Capture plugin states
   */
  capturePluginStates() {
    const pluginStates = {};

    // Capture active plugins
    if (window.pluginManager) {
      pluginStates.activePlugins = window.pluginManager.getActivePlugins ? window.pluginManager.getActivePlugins() : [];
    }

    return pluginStates;
  }

  /**
   * Capture settings
   */
  captureSettings() {
    const settings = {};

    // Capture various settings
    if (window.configManager) {
      settings.config = window.configManager.getConfig ? window.configManager.getConfig() : {};
    }

    return settings;
  }

  /**
   * Get currently active modal
   */
  getActiveModal() {
    const modals = document.querySelectorAll('.modal.show');
    return modals.length > 0 ? modals[0].id : null;
  }

  /**
   * Rollback to a specific checkpoint
   */
  async rollbackToCheckpoint(checkpointId) {
    try {
      const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId);
      if (!checkpoint) {
        throw new Error(`Checkpoint with ID ${checkpointId} not found`);
      }

      // Show confirmation dialog
      const confirmed = await this.confirmRollback(checkpoint);
      if (!confirmed) return false;

      // Create backup checkpoint before rollback
      await this.createCheckpoint('Before Rollback', this.CHECKPOINT_TYPES.AUTO, {
        rollbackTo: checkpointId,
        rollbackName: checkpoint.name,
      });

      // Restore state
      await this.restoreSystemState(checkpoint.state);

      this.genomeBrowser.showNotification(`Rolled back to checkpoint: ${checkpoint.name}`, 'success');
      console.log(`✅ Rolled back to checkpoint: ${checkpoint.name}`);

      return true;
    } catch (error) {
      console.error('❌ Error rolling back to checkpoint:', error);
      this.genomeBrowser.showNotification('Failed to rollback to checkpoint', 'error');
      return false;
    }
  }

  /**
   * Restore system state from checkpoint
   */
  async restoreSystemState(state) {
    try {
      // Restore Genome Browser state
      if (state.genomeBrowser) {
        await this.restoreGenomeBrowserState(state.genomeBrowser);
      }

      // Restore Action Manager state
      if (state.actionManager && window.actionManager) {
        window.actionManager.restoreState(state.actionManager);
      }

      // Restore UI state
      if (state.ui) {
        this.restoreUIState(state.ui);
      }

      // Restore file manager state
      if (state.fileManager && this.genomeBrowser.fileManager) {
        this.restoreFileManagerState(state.fileManager);
      }

      console.log('✅ System state restored successfully');
    } catch (error) {
      console.error('❌ Error restoring system state:', error);
      throw error;
    }
  }

  /**
   * Restore genome browser state
   */
  async restoreGenomeBrowserState(genomeBrowserState) {
    // Restore current file if different
    if (genomeBrowserState.currentFile && genomeBrowserState.currentFile !== this.genomeBrowser.currentFile) {
      // This would need to trigger file loading
      console.log('📁 File restoration needed:', genomeBrowserState.currentFile);
    }

    // Restore position and zoom
    if (genomeBrowserState.currentChromosome) {
      this.genomeBrowser.currentChromosome = genomeBrowserState.currentChromosome;
    }

    if (genomeBrowserState.currentPosition) {
      this.genomeBrowser.currentPosition = genomeBrowserState.currentPosition;
    }

    if (genomeBrowserState.zoomLevel) {
      this.genomeBrowser.zoomLevel = genomeBrowserState.zoomLevel;
    }

    if (genomeBrowserState.viewStart && genomeBrowserState.viewEnd) {
      this.genomeBrowser.viewStart = genomeBrowserState.viewStart;
      this.genomeBrowser.viewEnd = genomeBrowserState.viewEnd;
    }

    // Trigger view refresh
    if (this.genomeBrowser.displayGenomeView) {
      this.genomeBrowser.displayGenomeView();
    }
  }

  /**
   * Restore UI state
   */
  restoreUIState(uiState) {
    // Restore panel states
    if (uiState.panelStates) {
      Object.keys(uiState.panelStates).forEach(panelId => {
        const panel = document.getElementById(panelId);
        const state = uiState.panelStates[panelId];

        if (panel && state) {
          if (state.visible) {
            panel.classList.remove('hidden');
          } else {
            panel.classList.add('hidden');
          }

          if (state.collapsed) {
            panel.classList.add('collapsed');
          } else {
            panel.classList.remove('collapsed');
          }
        }
      });
    }

    // Restore track settings
    if (uiState.trackSettings) {
      this.genomeBrowser.trackSettings = uiState.trackSettings;
    }

    // Restore view mode
    if (uiState.viewMode) {
      if (uiState.viewMode.sequenceMode) {
        this.genomeBrowser.sequenceMode = uiState.viewMode.sequenceMode;
      }
      if (uiState.viewMode.displayMode) {
        this.genomeBrowser.displayMode = uiState.viewMode.displayMode;
      }
    }
  }

  /**
   * Restore file manager state
   */
  restoreFileManagerState(fileManagerState) {
    if (fileManagerState.recentFiles) {
      this.genomeBrowser.fileManager.recentFiles = [...fileManagerState.recentFiles];
    }

    if (fileManagerState.fileHistory) {
      this.genomeBrowser.fileManager.fileHistory = [...fileManagerState.fileHistory];
    }
  }

  /**
   * Show checkpoint list dialog
   */
  showCheckpointList() {
    this.updateCheckpointListUI();
    this.refresh();

    // Show the action list modal which contains checkpoint management
    const modal = document.getElementById('actionListModal');
    if (modal) {
      modal.classList.add('show');
    }
  }

  /**
   * Update checkpoint list UI
   */
  updateCheckpointListUI() {
    const content = document.getElementById('checkpointListContent');
    if (!content) return;

    if (this.checkpoints.length === 0) {
      content.innerHTML = `
                <div class="empty-checkpoints-message">
                    <i class="fas fa-bookmark"></i>
                    <p>No checkpoints created</p>
                    <small>Create checkpoints to save current state</small>
                </div>
            `;
      return;
    }

    // Sort checkpoints by timestamp (newest first)
    const sortedCheckpoints = [...this.checkpoints].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    content.innerHTML = sortedCheckpoints.map(checkpoint => this.renderCheckpointItem(checkpoint)).join('');

    // Add event listeners
    sortedCheckpoints.forEach(checkpoint => {
      const rollbackBtn = document.getElementById(`rollback-${checkpoint.id}`);
      const deleteBtn = document.getElementById(`delete-${checkpoint.id}`);
      const infoBtn = document.getElementById(`info-${checkpoint.id}`);

      rollbackBtn?.addEventListener('click', () => this.rollbackToCheckpoint(checkpoint.id));
      deleteBtn?.addEventListener('click', () => this.deleteCheckpoint(checkpoint.id));
      infoBtn?.addEventListener('click', () => this.showCheckpointInfo(checkpoint.id));
    });
  }

  /**
   * Render single checkpoint item
   */
  renderCheckpointItem(checkpoint) {
    const typeIcon = this.getCheckpointTypeIcon(checkpoint.type);
    const timeAgo = this.getTimeAgo(checkpoint.timestamp);
    const sizeFormatted = this.formatSize(checkpoint.size);

    return `
            <div class="checkpoint-item" data-checkpoint-id="${checkpoint.id}">
                <div class="checkpoint-info">
                    <div class="checkpoint-name">
                        <i class="fas ${typeIcon}"></i>
                        ${checkpoint.name}
                    </div>
                    <div class="checkpoint-time">
                        ${timeAgo} • ${sizeFormatted}
                    </div>
                </div>
                <div class="checkpoint-controls-item">
                    <button id="rollback-${checkpoint.id}" class="btn btn-sm btn-primary" title="Rollback">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button id="info-${checkpoint.id}" class="btn btn-sm btn-secondary" title="Info">
                        <i class="fas fa-info"></i>
                    </button>
                    <button id="delete-${checkpoint.id}" class="btn btn-sm btn-warning" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
  }

  /**
   * Get checkpoint type icon
   */
  getCheckpointTypeIcon(type) {
    const icons = {
      [this.CHECKPOINT_TYPES.MANUAL]: 'fa-bookmark',
      [this.CHECKPOINT_TYPES.AUTO]: 'fa-clock',
      [this.CHECKPOINT_TYPES.BEFORE_ACTION]: 'fa-shield-alt',
      [this.CHECKPOINT_TYPES.MILESTONE]: 'fa-flag',
    };
    return icons[type] || 'fa-bookmark';
  }

  /**
   * Get time ago string
   */
  getTimeAgo(timestamp) {
    const now = new Date();
    const checkpointTime = new Date(timestamp);
    const diffMs = now - checkpointTime;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return checkpointTime.toLocaleDateString();
  }

  /**
   * Format size in bytes
   */
  formatSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Delete checkpoint
   */
  async deleteCheckpoint(checkpointId) {
    try {
      const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId);
      if (!checkpoint) return;

      const confirmed = await this.showDeleteConfirmModal(checkpoint.name);
      if (!confirmed) return;

      const genomePath = this.genomePath;
      const result = await this.invokeStore('checkpoints:remove', { genomePath, ids: [checkpointId] });
      this.applyStoreList(genomePath, result.checkpoints);

      this.genomeBrowser.showNotification(`Checkpoint "${checkpoint.name}" deleted`, 'success');
    } catch (error) {
      console.error('❌ Error deleting checkpoint:', error);
      this.genomeBrowser.showNotification('Failed to delete checkpoint', 'error');
    }
  }

  /**
   * Show delete confirmation modal
   */
  async showDeleteConfirmModal(checkpointName) {
    return new Promise(resolve => {
      this.showConfirmModal(
        'Delete Checkpoint',
        `Are you sure you want to delete checkpoint "${checkpointName}"?\n\nThis action cannot be undone.`,
        resolve
      );
    });
  }

  /**
   * Show checkpoint information dialog
   */
  showCheckpointInfo(checkpointId) {
    const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId);
    if (!checkpoint) return;

    const info = `
            <strong>Checkpoint Information</strong><br><br>
            <strong>Name:</strong> ${checkpoint.name}<br>
            <strong>Type:</strong> ${checkpoint.type}<br>
            <strong>Created:</strong> ${checkpoint.timestamp.toLocaleString()}<br>
            <strong>Size:</strong> ${this.formatSize(checkpoint.size)}<br>
            <strong>ID:</strong> ${checkpoint.id}<br><br>
            <strong>State Summary:</strong><br>
            • File: ${checkpoint.state.genomeBrowser?.currentFile?.path || checkpoint.state.genomeBrowser?.currentFile || 'None'}<br>
            • Chromosome: ${checkpoint.state.genomeBrowser?.currentChromosome || 'None'}<br>
            • Position: ${checkpoint.state.genomeBrowser?.currentPosition || 'None'}<br>
            • Actions: ${checkpoint.state.actionManager?.actions?.length || 0}<br>
        `;

    // Create and show info modal
    this.showInfoModal('Checkpoint Information', info);
  }

  /**
   * Show info modal
   */
  showInfoModal(title, content) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('checkpointInfoModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'checkpointInfoModal';
      modal.className = 'modal';
      modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="checkpointInfoTitle">${title}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="checkpointInfoContent">${content}</div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn modal-close">Close</button>
                    </div>
                </div>
            `;
      document.body.appendChild(modal);

      // Add close event listeners
      modal.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => modal.classList.remove('show'));
      });
    } else {
      document.getElementById('checkpointInfoTitle').textContent = title;
      document.getElementById('checkpointInfoContent').innerHTML = content;
    }

    modal.classList.add('show');
  }

  /**
   * Generate checkpoint name
   */
  generateCheckpointName(type) {
    const timestamp = new Date();
    const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const prefixes = {
      [this.CHECKPOINT_TYPES.MANUAL]: 'Manual',
      [this.CHECKPOINT_TYPES.AUTO]: 'Auto',
      [this.CHECKPOINT_TYPES.BEFORE_ACTION]: 'Before Action',
      [this.CHECKPOINT_TYPES.MILESTONE]: 'Milestone',
    };

    const prefix = prefixes[type] || 'Checkpoint';
    return `${prefix} ${timeString}`;
  }

  /**
   * Calculate state size
   */
  calculateStateSize(state) {
    try {
      return new Blob([JSON.stringify(state)]).size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Prompt for checkpoint name using custom modal
   */
  async promptForCheckpointName() {
    return new Promise(resolve => {
      this.showNamePromptModal(resolve);
    });
  }

  /**
   * Show custom name prompt modal
   */
  showNamePromptModal(callback) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('checkpointNamePromptModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'checkpointNamePromptModal';
      modal.className = 'modal';
      modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>Create Checkpoint</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="checkpointNamePromptInput">Checkpoint Name:</label>
                            <input type="text" id="checkpointNamePromptInput" class="form-control" 
                                   placeholder="Enter checkpoint name..." 
                                   value="${this.generateCheckpointName(this.CHECKPOINT_TYPES.MANUAL)}">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="checkpointNamePromptConfirm" class="btn btn-primary">Create</button>
                        <button class="btn modal-close">Cancel</button>
                    </div>
                </div>
            `;
      document.body.appendChild(modal);
    } else {
      // Update the default value
      const input = modal.querySelector('#checkpointNamePromptInput');
      if (input) {
        input.value = this.generateCheckpointName(this.CHECKPOINT_TYPES.MANUAL);
      }
    }

    // Set up event listeners
    const confirmBtn = modal.querySelector('#checkpointNamePromptConfirm');
    const input = modal.querySelector('#checkpointNamePromptInput');
    const closeButtons = modal.querySelectorAll('.modal-close');

    const handleConfirm = () => {
      const name = input.value.trim();
      modal.classList.remove('show');
      callback(name || null);
    };

    const handleCancel = () => {
      modal.classList.remove('show');
      callback(null);
    };

    // Remove existing listeners
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    const newConfirmBtn = modal.querySelector('#checkpointNamePromptConfirm');

    newConfirmBtn.addEventListener('click', handleConfirm);

    closeButtons.forEach(btn => {
      btn.replaceWith(btn.cloneNode(true));
    });

    modal.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', handleCancel);
    });

    // Handle Enter key
    input.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        handleConfirm();
      }
    });

    // Show modal and focus input
    modal.classList.add('show');
    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);
  }

  /**
   * Confirm rollback action using custom modal
   */
  async confirmRollback(checkpoint) {
    return new Promise(resolve => {
      this.showConfirmModal(
        'Confirm Rollback',
        `Are you sure you want to rollback to checkpoint "${checkpoint.name}"?\n\nThis will restore the system state from ${checkpoint.timestamp.toLocaleString()}.\n\nCurrent state will be automatically saved as a backup.`,
        resolve
      );
    });
  }

  /**
   * Show custom confirmation modal
   */
  showConfirmModal(title, message, callback) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('checkpointConfirmModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'checkpointConfirmModal';
      modal.className = 'modal';
      modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3 id="checkpointConfirmTitle">${title}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="checkpointConfirmMessage" style="white-space: pre-line; line-height: 1.5;">
                            ${message}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="checkpointConfirmYes" class="btn btn-primary">Yes, Rollback</button>
                        <button class="btn btn-secondary modal-close">Cancel</button>
                    </div>
                </div>
            `;
      document.body.appendChild(modal);
    } else {
      // Update content
      modal.querySelector('#checkpointConfirmTitle').textContent = title;
      modal.querySelector('#checkpointConfirmMessage').textContent = message;
    }

    // Set up event listeners
    const confirmBtn = modal.querySelector('#checkpointConfirmYes');
    const closeButtons = modal.querySelectorAll('.modal-close');

    const handleConfirm = () => {
      modal.classList.remove('show');
      callback(true);
    };

    const handleCancel = () => {
      modal.classList.remove('show');
      callback(false);
    };

    // Remove existing listeners
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    const newConfirmBtn = modal.querySelector('#checkpointConfirmYes');

    newConfirmBtn.addEventListener('click', handleConfirm);

    closeButtons.forEach(btn => {
      btn.replaceWith(btn.cloneNode(true));
    });

    modal.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', handleCancel);
    });

    // Show modal
    modal.classList.add('show');
  }

  /**
   * Start auto-save timer
   */
  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(() => {
      this.createAutoCheckpoint();
    }, this.autoSaveInterval);

    console.log('🕐 Auto-save timer started (5 minutes interval)');
  }

  /**
   * Create auto checkpoint
   */
  async createAutoCheckpoint() {
    try {
      if (!this.getCurrentGenomePath()) return;
      await this.syncWithCurrentGenome();

      // Only create auto checkpoint if there are significant changes
      const state = await this.captureSystemState();
      if (this.shouldCreateAutoCheckpoint(state)) {
        await this.createCheckpoint(
          this.generateCheckpointName(this.CHECKPOINT_TYPES.AUTO),
          this.CHECKPOINT_TYPES.AUTO,
          {},
          state
        );
        console.log('🕐 Auto checkpoint created');
      }
    } catch (error) {
      console.error('❌ Error creating auto checkpoint:', error);
    }
  }

  /**
   * Check if auto checkpoint should be created
   */
  shouldCreateAutoCheckpoint(state = null) {
    // Checkpoints belong to a genome file
    if (!this.getCurrentGenomePath()) return false;

    // Don't create if no checkpoints exist
    if (this.checkpoints.length === 0) return true;

    // Don't create if last checkpoint was recent (less than 4 minutes ago). The list is shared by
    // every view of this genome, so one view's checkpoint also covers the others.
    const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];
    const timeSinceLastCheckpoint = Date.now() - new Date(lastCheckpoint.timestamp).getTime();
    if (timeSinceLastCheckpoint < 240000) return false; // 4 minutes

    // Don't create if nothing changed since the last checkpoint
    if (state && this.getStateSignature(state) === this.getStateSignature(lastCheckpoint.state)) return false;

    // Create if there are pending actions
    if (window.actionManager && window.actionManager.actions.length > 0) return true;

    // Create if file has been loaded/changed
    if (this.genomeBrowser.currentFile) return true;

    return false;
  }

  /**
   * Older versions kept every view's checkpoints in one localStorage key. Move them into the
   * per-genome store once, grouped by the genome each checkpoint was taken on, then drop the key.
   */
  async importLegacyCheckpoints() {
    let stored = null;
    try {
      stored = localStorage.getItem(CheckpointManager.LEGACY_STORAGE_KEY);
    } catch (error) {
      return;
    }
    if (!stored) return;

    try {
      const data = JSON.parse(stored);
      const groups = this.groupLegacyCheckpoints(Array.isArray(data?.checkpoints) ? data.checkpoints : []);
      const result = await this.invokeStore('checkpoints:import-legacy', { groups });
      localStorage.removeItem(CheckpointManager.LEGACY_STORAGE_KEY);
      if (!result.alreadyImported) {
        console.log(`📂 Imported ${result.imported} legacy checkpoints into the per-genome store`);
      }
    } catch (error) {
      console.error('❌ Error importing legacy checkpoints:', error);
    }
  }

  /**
   * Group legacy checkpoints by genome file. Each one records the files that were loaded; the last
   * FASTA/GenBank among them was the genome. Embedded file data is stripped and runs of identical
   * auto checkpoints are collapsed; checkpoints with no genome are dropped.
   */
  groupLegacyCheckpoints(checkpoints) {
    const groups = new Map();
    const previousAutoSignatures = new Map();

    for (const checkpoint of checkpoints) {
      const genomeBrowserState = checkpoint?.state?.genomeBrowser;
      const genomeFile = (genomeBrowserState?.loadedFiles || [])
        .filter(file => file && (file.type === 'GenBank' || file.type === 'FASTA') && file.path)
        .pop();
      if (!genomeFile) continue;

      genomeBrowserState.currentFile = this.summarizeCurrentFile(genomeBrowserState.currentFile);
      // The store assigns a fresh id
      const legacyCheckpoint = { ...checkpoint, size: this.calculateStateSize(checkpoint.state) };

      if (legacyCheckpoint.type === this.CHECKPOINT_TYPES.AUTO) {
        const signature = this.getStateSignature(legacyCheckpoint.state);
        if (previousAutoSignatures.get(genomeFile.path) === signature) continue;
        previousAutoSignatures.set(genomeFile.path, signature);
      } else {
        previousAutoSignatures.delete(genomeFile.path);
      }

      if (!groups.has(genomeFile.path)) groups.set(genomeFile.path, []);
      groups.get(genomeFile.path).push(legacyCheckpoint);
    }

    return Array.from(groups, ([genomePath, groupCheckpoints]) => ({ genomePath, checkpoints: groupCheckpoints }));
  }

  /**
   * Export checkpoints to file
   */
  async exportCheckpoints() {
    try {
      const data = {
        exported: new Date().toISOString(),
        version: '1.0.0',
        checkpoints: this.checkpoints,
        metadata: {
          count: this.checkpoints.length,
          totalSize: this.checkpoints.reduce((sum, cp) => sum + (cp.size || 0), 0),
        },
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `genomeai_checkpoints_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.genomeBrowser.showNotification('Checkpoints exported successfully', 'success');
    } catch (error) {
      console.error('❌ Error exporting checkpoints:', error);
      this.genomeBrowser.showNotification('Failed to export checkpoints', 'error');
    }
  }

  /**
   * Import checkpoints from file
   */
  async importCheckpoints(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.checkpoints || !Array.isArray(data.checkpoints)) {
        throw new Error('Invalid checkpoint file format');
      }

      const genomePath = this.getCurrentGenomePath();
      if (!genomePath) {
        throw new Error('Load a genome before importing checkpoints');
      }

      // The store assigns new ids to the imported checkpoints
      const result = await this.invokeStore('checkpoints:add', { genomePath, checkpoints: data.checkpoints });
      this.applyStoreList(genomePath, result.checkpoints);

      this.genomeBrowser.showNotification(`Imported ${result.added.length} checkpoints`, 'success');
    } catch (error) {
      console.error('❌ Error importing checkpoints:', error);
      this.genomeBrowser.showNotification('Failed to import checkpoints', 'error');
    }
  }

  /**
   * Clear all checkpoints
   */
  async clearAllCheckpoints() {
    const confirmed = await this.showClearAllConfirmModal();
    if (!confirmed) return;

    try {
      const genomePath = this.genomePath;
      if (genomePath) {
        const result = await this.invokeStore('checkpoints:remove', { genomePath, all: true });
        this.applyStoreList(genomePath, result.checkpoints);
      }

      this.genomeBrowser.showNotification('All checkpoints cleared', 'success');
    } catch (error) {
      console.error('❌ Error clearing checkpoints:', error);
      this.genomeBrowser.showNotification('Failed to clear checkpoints', 'error');
    }
  }

  /**
   * Show clear all confirmation modal
   */
  async showClearAllConfirmModal() {
    return new Promise(resolve => {
      this.showConfirmModal(
        'Clear All Checkpoints',
        `Are you sure you want to delete ALL checkpoints?\n\nThis will permanently remove ${this.checkpoints.length} checkpoint(s).\n\nThis action cannot be undone.`,
        resolve
      );
    });
  }

  /**
   * Get checkpoint statistics
   */
  getCheckpointStats() {
    const stats = {
      total: this.checkpoints.length,
      manual: this.checkpoints.filter(cp => cp.type === this.CHECKPOINT_TYPES.MANUAL).length,
      auto: this.checkpoints.filter(cp => cp.type === this.CHECKPOINT_TYPES.AUTO).length,
      beforeAction: this.checkpoints.filter(cp => cp.type === this.CHECKPOINT_TYPES.BEFORE_ACTION).length,
      milestone: this.checkpoints.filter(cp => cp.type === this.CHECKPOINT_TYPES.MILESTONE).length,
      totalSize: this.checkpoints.reduce((sum, cp) => sum + (cp.size || 0), 0),
      oldestDate:
        this.checkpoints.length > 0 ? Math.min(...this.checkpoints.map(cp => new Date(cp.timestamp).getTime())) : null,
      newestDate:
        this.checkpoints.length > 0 ? Math.max(...this.checkpoints.map(cp => new Date(cp.timestamp).getTime())) : null,
    };

    return stats;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    console.log('🧹 CheckpointManager destroyed');
  }
}

// Export for Node/test environments; in the renderer this class is loaded as a script-tag global.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CheckpointManager;
}
